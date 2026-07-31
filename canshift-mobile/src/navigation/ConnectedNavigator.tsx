import React from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import DashScreen from '../screens/DashScreen'
import GraphScreen from '../screens/GraphScreen'
import LogScreen from '../screens/LogScreen'
import TimerScreen from '../screens/TimerScreen'
import ReconnectBanner from '../components/ReconnectBanner'
import ReconnectFailedDialog from '../components/ReconnectFailedDialog'
import { Colors, Typography } from '../theme'
import type { RootStackParamList } from './index'

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Connected'>
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ConnectedTabParamList = {
  Dash: undefined
  Graph: undefined
  Timer: undefined
  Console: undefined
}

const Tab = createBottomTabNavigator<ConnectedTabParamList>()

const TabIcon = ({ icon, focused }: { icon: string; focused: boolean }) => {
  return (
    <Text style={[styles.tabIcon, { color: focused ? Colors.accent : Colors.textMuted }]}>
      {icon}
    </Text>
  )
}

export default function ConnectedNavigator({ navigation }: Props) {
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  return (
    <View style={styles.container}>
      <ReconnectBanner navigation={navigation} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: isLandscape
            ? {
                backgroundColor: Colors.surface,
                borderTopColor: Colors.border,
                height: 44,
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
          name="Graph"
          component={GraphScreen}
          options={{
            tabBarLabel: 'Graph',
            tabBarIcon: ({ focused }) => <TabIcon icon="∿" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Timer"
          component={TimerScreen}
          options={{
            tabBarLabel: 'Timer',
            tabBarIcon: ({ focused }) => <TabIcon icon="◷" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Console"
          component={LogScreen}
          options={{
            tabBarLabel: 'Console',
            tabBarIcon: ({ focused }) => <TabIcon icon="≡" focused={focused} />,
          }}
        />
      </Tab.Navigator>
      <ReconnectFailedDialog navigation={navigation} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  tabIcon: { fontSize: 18 },
})
