import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Helmet, HelmetData} from 'react-helmet'
import Homepage from './Homepage'
import {observable, action, computed} from 'mobx'
import {observer} from 'mobx-react'
declare const require: any
const wanakana = require('wanakana')

import * as pokenames from './pokenames'
import './index.scss'

class Pokemon extends React.Component<{ left: number, number: number }> {
    render() {
        const {left, number} = this.props
        return <div className="pokemon walkin"/>
    }
}

@observer
class Main extends React.Component {
    @observable pokeIndex: number = 134//Math.floor(Math.random()*pokenames.en.length)
    @observable answer: string = ""
    @observable validate: boolean = false
    @observable windowWidth = window.innerWidth
    @observable windowHeight = window.innerHeight

    @action.bound onInput(e: React.FormEvent<HTMLInputElement>) {
        this.answer = e.currentTarget.value
    }

    @action.bound onKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            this.validate = true
        }
    }

    @computed get isValid() {
        return this.answer === wanakana.toRomaji(pokenames.ja[this.pokeIndex])
    }

    @computed get pokemonLeft() {
        return 1*this.animElapsed
    }

    @observable animElapsed: number = 0

    render() {
        const {pokeIndex, pokemonLeft, answer, validate, isValid} = this

        return <div className="text-center">
            <Pokemon left={pokemonLeft} number={pokeIndex+1}/>
            <div>#{pokeIndex+1} {pokenames.ja[pokeIndex]}</div>
            <input type="text" className={`form-control ${validate ? (isValid ? "is-valid" : "is-invalid") : ""}`} placeholder="romaji..." value={answer} onInput={this.onInput} onKeyPress={this.onKeyPress}/>
        </div>
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))