import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ScanScreen from '../screens/ScanScreen'
import DashScreen from '../screens/DashScreen'
import SettingsScreen from '../screens/SettingsScreen'
import UpdateScreen from '../screens/UpdateScreen'

export type RootStackParamList = {
  Scan: undefined
  Dash: undefined
  Settings: undefined
  Update: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Scan">
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Dash" component={DashScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Update" component={UpdateScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
