import { registerRootComponent } from 'expo'
import { markAppLaunch } from './src/diag/cold-start'
import App from './src/App'

markAppLaunch()

registerRootComponent(App)
