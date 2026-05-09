import { registerRootComponent } from 'expo'
import { markAppLaunch } from './src/diag/cold-start'
import App from './src/App'

// Stamp the launch time as the first thing after bundle eval — every ms after
// this point counts toward the cold-start budget.
markAppLaunch()

registerRootComponent(App)
