import React, { Component, Children } from 'react';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TestHookStore from './TestHookStore';
import TestScope from './TestScope';
import TestRunner from './TestRunner';
import Reporter from './Reporter';

// Public: Wrap your entire app in Tester to run tests against that app,
// interacting with registered components in your test cases via the Cavy
// helpers (defined in TestScope).
//
// This component wraps your app inside a <TesterContext.Provider> which ensures
// the testHookStore is in scope when Cavy runs your tests.
//
// store             - An instance of TestHookStore.
// specs             - An array of spec functions.
// reporter          - A function that is called with the test report as an
//                     argument in place of sending the report to cavy-cli. If
//                     no reporter prop is present, then Cavy will by default
//                     send the report to cavy-cli if the test server is running.
// waitTime          - An integer representing the time in milliseconds that
//                     the testing framework should wait for the function
//                     findComponent() to return the 'hooked' component.
// startDelay        - An integer representing the time in milliseconds before
//                     test execution begins.
// clearAsyncStorage - A boolean to determine whether to clear AsyncStorage
//                     between each test. Defaults to `false`.
//
// Example
//
//   import { Tester, TestHookStore } from 'cavy';
//
//   import MyFeatureSpec from './specs/MyFeatureSpec';
//   import OtherFeatureSpec from './specs/OtherFeatureSpec';
//
//   const testHookStore = new TestHookStore();
//
//   export default class AppWrapper extends React.Component {
//     // ....
//     render() {
//       return (
//         <Tester specs={[MyFeatureSpec, OtherFeatureSpec]} store={testHookStore}>
//           <App />
//         </Tester>
//       );
//     }
//   }
//
export const TesterContext = React.createContext();

export default class Tester extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      key: Math.random()
    };
    this.testHookStore = props.store;
    // Default to sending a test report to cavy-cli if no custom reporter is
    // supplied.
    if (props.reporter instanceof Function) {
      const message = 'Deprecation warning: support for custom function' +
                      'reporters will soon be deprecated. Cavy supports custom ' +
                      'class based reporters. For more info, see the ' +
                      'documentation here: ' +
                      'https://cavy.app/docs/guides/writing-custom-reporters';
      console.warn(message);
      this.reporter = props.reporter;
    } else {
      reporterClass = props.reporter || Reporter;
      this.reporter = new reporterClass;
    }
  }

  componentDidMount() {
    this.runTests();
    if (!(this.reporter instanceof Function)
      && this.reporter.type == 'realtime' ) {
      this.reporter.onStart();
    }
  }

  // Run all test suites.
  async runTests() {
    const { specs, waitTime, startDelay, sendReport, only } = this.props;
    const testSuites = [];
    // Iterate over each suite of specs and create a new TestScope for each.
    for (var i = 0; i < specs.length; i++) {
      const scope = new TestScope(this, waitTime);
      await specs[i](scope);
      testSuites.push(scope);
    }

    // Instantiate the test runner with the test suites, the reporter to use,
    // the startDelay to apply, and the `only` filter to apply.
    const runner = new TestRunner(
      this,
      testSuites,
      startDelay,
      this.reporter,
      sendReport,
      only
    );

    // Run the tests.
    runner.run();
  }

  reRender() {
    this.setState({key: Math.random()});
  }

  // Clear everything from AsyncStorage, warn if anything goes wrong.
  async clearAsync() {
    if (this.props.clearAsyncStorage) {
      try {
        await AsyncStorage.getAllKeys().then(AsyncStorage.multiRemove)
      } catch(e) {
        console.warn("[Cavy] failed to clear AsyncStorage:", e);
      }
    }
  }

  render() {
    return (
      <TesterContext.Provider key={this.state.key} value={this.testHookStore}>
        {Children.only(this.props.children)}
      </TesterContext.Provider>
    );
  }
}

Tester.propTypes = {
  clearAsyncStorage: PropTypes.bool,
  only: PropTypes.arrayOf(PropTypes.string),
  reporter: PropTypes.func,
  // Deprecated (see note in TestRunner component)
  sendReport: PropTypes.bool,
  specs: PropTypes.arrayOf(PropTypes.func),
  startDelay: PropTypes.number,
  store: PropTypes.instanceOf(TestHookStore),
  waitTime: PropTypes.number
};

Tester.defaultProps = {
  clearAsyncStorage: false,
  startDelay: 0,
  waitTime: 2000
};
