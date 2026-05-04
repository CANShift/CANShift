// ConnectedNavigator.tsx — Bottom tab navigator shown after device connect

import React from 'react'
import { Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import DashScreen from '../screens/DashScreen'
import LogScreen from '../screens/LogScreen'
import { Colors, Typography } from '../theme'
import type { RootStackParamList } from './index'

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

export type ConnectedTabParamList = {
  Dash: undefined
  Log: undefined
}

const Tab = createBottomTabNavigator<ConnectedTabParamList>()

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, color: focused ? Colors.accent : Colors.textMuted }}>
      {icon}
    </Text>
  )
}

export default function ConnectedNavigator({ navigation }: Props) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: Typography.xs },
      }}
    >
      <Tab.Screen
        name="Dash"
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon icon="◉" focused={focused} />,
        }}
      >
        {/* Pass parent stack navigation so DashScreen can push Settings/Update */}
        {() => <DashScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="Log"
        component={LogScreen}
        options={{
          tabBarLabel: 'Log',
          tabBarIcon: ({ focused }) => <TabIcon icon="≡" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}
