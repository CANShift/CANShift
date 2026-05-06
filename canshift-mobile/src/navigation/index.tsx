// navigation/index.tsx — Root stack navigator

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import ScanScreen from '../screens/ScanScreen'
import SettingsScreen from '../screens/SettingsScreen'
import UpdateScreen from '../screens/UpdateScreen'
import ConnectedNavigator from './ConnectedNavigator'

// Must remain a `type` (not `interface`) — React Navigation's ParamListBase
// constraint requires an index-signature shape that interfaces don't satisfy.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type RootStackParamList = {
  Scan: undefined
  Connected: undefined
  Settings: undefined
  Update: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Scan">
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Connected" component={ConnectedNavigator} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Update" component={UpdateScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
