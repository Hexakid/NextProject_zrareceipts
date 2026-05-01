import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import ExpenseSubmitScreen from './src/screens/ExpenseSubmitScreen';
import ApprovalScreen from './src/screens/ApprovalScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Submit Expense" component={ExpenseSubmitScreen} />
        <Stack.Screen name="Approvals" component={ApprovalScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
