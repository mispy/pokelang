import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Helmet, HelmetData} from 'react-helmet'
import Homepage from './Homepage'
import {observable, action, computed} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
declare const require: any
const wanakana = require('wanakana')

import * as pokenames from './pokenames'
import './index.scss'

const MAX_POKEMON = 493

class Pokemon extends React.Component<{ number: number, out?: boolean, hidden?: boolean }> {
    render() {
        const {number, out, hidden} = this.props
        return <div style={`--frame1-url: url("../overworld/right/${number}.png"); --frame2-url: url("../overworld/right/frame2/${number}.png");` as any} className={`pokemon ${out ? "walkout" : "walkin"}${hidden ? " hidden" : ""}`}/>
    }
}

@observer
class Main extends React.Component {
    @observable prevPoke?: number
    @observable question: number = 1
    @observable poke: number = 98//Math.floor(Math.random()*pokenames.en.length)
    @observable nextPoke: number = _.random(1, MAX_POKEMON)
    @observable hintCount: number = 0
    @observable input: string = ""


    @computed get japanese(): string {
        return pokenames.ja[this.poke-1]
    }
    @computed get trueAnswer(): string {
        return wanakana.toRomaji(this.japanese)
    }

    @action.bound onKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            if (this.input.toLowerCase() === this.trueAnswer.toLowerCase()) {
                this.prevPoke = this.poke
                this.poke = this.nextPoke
                this.nextPoke = _.random(1, MAX_POKEMON)
                this.question += 1
                this.hintCount = 0
                this.input = ""
            }
        }
    }

    @action.bound onInput(e: React.FormEvent<HTMLInputElement>) {
        this.input = e.currentTarget.value
    }

    @action.bound onHint() {
        this.hintCount += 1
    }

    @computed get pokemonLeft() {
        return 1*this.animElapsed
    }

    @observable animElapsed: number = 0

    render() {
        const {poke, prevPoke, nextPoke, japanese, input} = this

        return <div className="container text-center">
            <div className="runway">
                <Pokemon number={poke} key={this.question}/>
                {prevPoke && <Pokemon number={prevPoke} out={true} key={`prev-${this.question}`}/>}
                {nextPoke && <Pokemon number={nextPoke} key={`next-${this.question}`} hidden={true}/>}
            </div>
            <div>#{poke} {japanese}</div>
            <input type="text" className={`form-control`} placeholder="romaji..." onKeyPress={this.onKeyPress} value={input} onInput={this.onInput}/>
            <button className="btn btn-light text-secondary" onClick={this.onHint}>hint</button>
            <div style={{height: "50px", marginTop: "10px"}}>
                {_.range(0, Math.min(this.hintCount, this.japanese.length)).map(i => 
                    <p>{/*this.japanese[i] + wanakana.toRomaji(this.japanese[i]) + " " + */this.japanese.slice(0, i+1) + " " + wanakana.toRomaji(this.japanese.slice(0, i+1))}</p>
                )}
            </div>
        </div>
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))