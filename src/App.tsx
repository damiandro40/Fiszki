import useAppController from './app/useAppController'
import AppShell from './app/AppShell'

const App = () => {
  const controller = useAppController()
  return <AppShell controller={controller}/>
}

export default App
