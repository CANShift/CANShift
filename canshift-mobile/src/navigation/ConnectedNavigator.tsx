// ConnectedNavigator.tsx — Bottom tab navigator shown after device connect

import React from 'react'
import { Text, useWindowDimensions } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import DashScreen from '../screens/DashScreen'
import GraphScreen from '../screens/GraphScreen'
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
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: isLandscape
          ? {
              backgroundColor: Colors.surface,
              borderTopColor: Colors.border,
              height: 36,
              paddingBottom: 0,
              paddingTop: 0,
            }
          : { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: isLandscape
          ? { fontSize: 9, marginBottom: 2 }
          : { fontSize: Typography.xs },
        tabBarIconStyle: isLandscape ? { marginTop: 2 } : undefined,
      }}
    >
      <Tab.Screen
        name="Dash"
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon icon="◉" focused={focused} />,
        }}
      >
        {() => <DashScreen navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="Log"
        component={GraphScreen}
        options={{
          tabBarLabel: 'Graph',
          tabBarIcon: ({ focused }) => <TabIcon icon="∿" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}
