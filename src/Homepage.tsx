import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action, autorun, reaction} from 'mobx'
import {observer} from 'mobx-react'

declare const require: any
const pokemon = require('pokemon')

declare const window: any



@observer
class Main extends React.Component<{}> {
    render() {
        return <div>
            boop
        </div>
    }
}

window.homepageStart = function() {
    function render() {
        ReactDOM.render(<Main/>, document.querySelector("main"))
    }

    window.onresize = render
    render()
}


@observer
export default class Homepage extends React.Component {
	render() {
        return <main> 
            <script async dangerouslySetInnerHTML={{__html: "window.homepageStart()"}}></script>
        </main>
	}
}
