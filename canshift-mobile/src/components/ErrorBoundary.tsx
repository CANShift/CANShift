import React from 'react'
import { Text, View } from 'react-native'
import { Button } from './ui'
import { log } from '../stores/log.store'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const stack = info.componentStack ?? '(no component stack)'
    log('error', `Render crash: ${error.message}\n${stack}`)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <View className="flex-1 items-center justify-center bg-bg px-6">
        <Text className="mb-2 text-2xl font-semibold text-text">Something went wrong</Text>
        <Text className="mb-6 text-center text-text-dim">{error.message}</Text>
        <Button onPress={this.reset}>
          <Text className="text-primary-foreground">Reconnect</Text>
        </Button>
      </View>
    )
  }
}
