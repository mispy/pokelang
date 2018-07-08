import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
declare const require: any
const wanakana = require('wanakana')

import * as pokenames from './pokenames'
import './index.scss'

declare const window: any
window.wanakana = wanakana
window.pokenames = pokenames

const MAX_POKEMON = 493

class Pokemon extends React.Component<{ number: number, out?: boolean, hidden?: boolean }> {
    render() {
        const {number, out, hidden} = this.props
        return <div style={`--frame1-url: url("../overworld/right/${number}.png"); --frame2-url: url("../overworld/right/frame2/${number}.png");` as any} className={`pokemon ${out ? "walkout" : "walkin"}${hidden ? " hidden" : ""}`}/>
    }
}



// TODO handle context dependent modifiers like "ー"
function splitKana(jp: string): string[] {
    const kana = []

    const beforeModifiers = ["ッ"]
    const afterModifiers = ["ー", "ャ", "ョ", "ュ", "ェ"]
    
    for (let i = 0; i < jp.length; i++) {
        let j = i
        while (beforeModifiers.indexOf(jp[j]) !== -1) {
            j += 1
        }
        while (afterModifiers.indexOf(jp[j+1]) !== -1) {
            j += 1
        }

        if (j > i) {
            kana.push(jp.slice(i, j+1))
            i = j
        } else {
            kana.push(jp.slice(i, i+1))
        }
    }

    return kana
}

function InlineButton(props: { active: boolean, children: any, onClick: any }) {
    return <button className={`inlineToggle${props.active ? " active" : ""}`} onClick={props.onClick}>{props.children}</button>
}

@observer
class Main extends React.Component {
    @observable prevPoke?: number
    @observable question: number = 1
    @observable poke: number = 135//Math.floor(Math.random()*pokenames.en.length)
    @observable nextPoke: number = _.random(1, MAX_POKEMON)
    @observable hintCount: number = 0
    @observable kanaIndex: number = 0
    @observable kanaMode: 'katakana'|'hiragana' = 'katakana'

    @computed get japanese(): string {
        const katakana = pokenames.ja[this.poke-1]
        if (this.kanaMode === 'hiragana')
            return wanakana.toHiragana(katakana)
        else
            return katakana
    }

    @computed get kana(): string[] {
        return splitKana(this.japanese)
    }

    @computed get currentKana(): string {
        return this.kana[this.kanaIndex]
    }

    @computed get optionSet(): string[] {
        return _.uniq(splitKana(pokenames.ja.join())).map(kana => wanakana.toRomaji(kana)).filter(r => r.length && r.match(/^\w+$/))
    }

    @computed get correctOption(): string {
        return wanakana.toRomaji(this.currentKana)
    }

    @computed get options(): string[] {
        return _.shuffle(_.sampleSize(this.optionSet, 3).concat([this.correctOption]))
    }

    @action.bound chooseOption(option: string) {
        if (option === this.correctOption) {
            this.kanaIndex += 1
        }

        if (this.kanaIndex >= this.kana.length) {
            this.onComplete()
        }
    }

    @action.bound onComplete() {
        this.prevPoke = this.poke
        this.poke = this.nextPoke
        this.nextPoke = _.random(1, MAX_POKEMON)
        this.question += 1
        this.hintCount = 0
        this.kanaIndex = 0
    }

    render() {
        const {poke, prevPoke, nextPoke, japanese, kana, options, currentKana, kanaIndex, kanaMode} = this
        /*for (const name of pokenames.ja) {
            const trueRomaji = wanakana.toRomaji(name)
            const splitRomaji = splitKana(name).map(kana => wanakana.toRomaji(kana)).join("")
            if (trueRomaji !== splitRomaji)
                console.log(name, trueRomaji, splitRomaji)
        }*/

        return <div className="app">
            <div className="sidebar">
                <h1>Jolteon's Adventures</h1>
                <p>Jolteon and his Pokémon friends are traveling the world to learn new languages. Can you help them to read their Japanese names in <InlineButton active={this.kanaMode === 'katakana'} onClick={action(e => this.kanaMode = 'katakana')}>katakana</InlineButton> and <InlineButton active={this.kanaMode ==='hiragana'} onClick={action(e => this.kanaMode = 'hiragana')}>hiragana</InlineButton>?</p>

                <hr/>
                <small>Created by <a href="https://mispy.me">Jaiden Mispy</a>. Dedicated to my trusty travel companion, <a href="/fizz.jpg">Fission the Jolteon</a>.</small><br/>
                <hr/>
                <small><a href="https://github.com/mispy/kanajolt">https://github.com/mispy/kanajolt</a></small>
            </div>
            <main className="container text-center">
                <div className="runway">
                    <Pokemon number={poke} key={this.question}/>
                    {prevPoke && <Pokemon number={prevPoke} out={true} key={`prev-${this.question}`}/>}
                    {nextPoke && <Pokemon number={nextPoke} key={`next-${this.question}`} hidden={true}/>}
                </div>
                <div>{currentKana}</div>
                {options.map(option => 
                    <button className="btn btn-light text-secondary romaji" onClick={e => this.chooseOption(option)} key={option}>{option}</button>
                )}
                <div>&nbsp;{_.range(0, kanaIndex).map(i => 
                    <span>{kana[i]} {wanakana.toRomaji(kana[i])}</span>
                )}</div>
            </main>
        </div>
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))