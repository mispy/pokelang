import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observer} from 'mobx-react'

declare const window: any

import * as pokenames from './pokenames'

@observer
class Main extends React.Component {
    render() {
        return <div>
            {pokenames.en}
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
