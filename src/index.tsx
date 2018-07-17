import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed, autorun, IReactionDisposer} from 'mobx'
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

function toggleAnimClass(el: HTMLElement, klass: string) {
    el.classList.remove(klass)
    setTimeout(() => el.classList.add(klass), 1)
}

@observer
class Pokemon extends React.Component<{ number: number, out?: boolean, hidden?: boolean, shakeCount?: number }> {
    base: HTMLDivElement
    componentDidUpdate() {
        if (this.props.shakeCount) {
            toggleAnimClass(this.base, "shake")
        }
    }

    render() {
        const {number, out, hidden} = this.props
        return <div style={`--frame1-url: url("../overworld/right/${number}.png"); --frame2-url: url("../overworld/right/frame2/${number}.png");` as any} className={`pokemon ${out ? "walkout" : "walkin"}${hidden ? " hidden" : ""}`} ref={e => this.base = e as any}/>
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
class PokemonPreloader extends React.Component<{ poke: number }> {
    @computed get imgsToLoad(): string[] {
        const {poke} = this.props
        const urls = []
        for (let dir of ['up', 'down', 'left', 'right']) {
            urls.push(`./overworld/${dir}/${poke}.png`)
            urls.push(`./overworld/${dir}/frame2/${poke}.png`)
        }
        return urls
    }

    render() {
        return <div style={{ opacity: 0, position: 'fixed', right: '-99999px' }}>
            {this.imgsToLoad.map(url => <img src={url}/>)}
            <audio src={`cries/${this.props.poke}.ogg`}/>
        </div>
    }
}

class GameState {
    @observable question: number = 1
    @observable hintCount: number = 0
    @observable kanaIndex: number = 0
    @observable kanaMode: 'katakana'|'hiragana' = 'katakana'
    @observable streakCounter: number = 0

    save() {
        console.log(JSON.stringify(this))
        localStorage.setItem('kanajolt', JSON.stringify(this))
    }

    @action.bound load() {
        const save = JSON.parse(localStorage.getItem('kanajolt') || "{}")
        for (const key in this) {
            if (key in save)
                this[key] = save[key]
        }
    }
}

@observer
class Main extends React.Component {
    game: GameState = new GameState()
    @observable showMenu: boolean = false
    @observable isMobile: boolean = false
    pokeDiv: HTMLDivElement

    @observable wrongChoices: string[] = []

    // The list of pokemon in order to show
    @computed get pokeList() {
        return _.range(1, MAX_POKEMON+1)
    }

    @computed get pokeIndex(): number {
        return this.game.question-1
    }

    // Pokedex number of current pokemon
    @computed get poke(): number {
        return this.pokeList[this.pokeIndex]
    }

    @computed get prevPoke(): number|undefined {
        return this.pokeList[this.pokeIndex-1]
    }

    @computed get nextPoke(): number {
        return this.pokeList[this.pokeIndex+1]
    }

    @computed get japanese(): string {
        const katakana = pokenames.ja[this.poke-1]
        // TODO fix extends in hiragana
        if (this.game.kanaMode === 'hiragana')
            return wanakana.toHiragana(katakana)
        else
            return katakana
    }

    @computed get kana(): string[] {
        return splitKana(this.japanese)
    }

    @computed get currentKana(): string {
        return this.kana[this.game.kanaIndex]
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

    @computed get numNamed(): number {
        return this.game.question-1
    }

    @action.bound chooseOption(option: string) {
        if (option === this.correctOption) {
            this.game.kanaIndex += 1
            this.game.streakCounter += 1
            this.wrongChoices = []
        } else {
            this.game.streakCounter = 0
            this.wrongChoices.push(option)
        }

        if (this.game.kanaIndex >= this.kana.length) {
            this.onComplete()
        }
    }

    @action.bound onComplete() {
        // TODO preloading
        const audio = new Audio(`cries/${this.poke}.ogg`)
        audio.volume = 0.05
        audio.play()

        this.game.question += 1
        this.game.kanaIndex = 0
    }

    @action.bound onResize() {
        this.isMobile = window.innerWidth < 700
    }

    dispose: IReactionDisposer
    componentDidMount() {
        this.onResize()
        window.addEventListener("resize", this.onResize)
        window.game = this.game

        this.game.load()
        this.dispose = autorun(() => this.game.save())
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
        this.dispose()
    }
    
    renderMain() {
        const {poke, prevPoke, nextPoke, kana, options, currentKana, wrongChoices, numNamed} = this
        const {question, kanaIndex, streakCounter} = this.game

        return <main>
            <div className="container text-center">
                <div className="runway">
                    <Pokemon number={poke} key={question} shakeCount={wrongChoices.length}/>
                    <PokemonPreloader poke={poke}/>
                    {prevPoke && <Pokemon number={prevPoke} out={true} key={`prev-${question}`}/>}
                    {nextPoke && <Pokemon number={nextPoke} key={`next-${question}`} hidden={true}/>}
                    {nextPoke && <PokemonPreloader poke={nextPoke}/>}
                </div>
                <div>{kana.map((k, i) => 
                    <span className={`kana${i === kanaIndex ? " current" : ""}`}>{k}</span>
                )}</div>
                {options.map((option, i) => 
                    <button className="btn btn-light text-secondary romaji" onClick={e => this.chooseOption(option)} disabled={_.includes(wrongChoices, option)}>{option}</button>
                )}
                <p>{streakCounter >= 2 && <div className="text-green">Streak: {streakCounter}</div>}</p>
                <p>{numNamed} named <span className="text-secondary">({this.pokeList.length - numNamed} to go)</span></p>
            </div>
        </main>
    }

    renderMenu() {
        return <div className="menu">
            <h1>Jolteon's Adventures</h1>
            <p>Jolteon and his Pokémon friends are traveling the world to learn new languages. Can you help them to read their Japanese names?</p>

            <hr/>
            <small>Created by <a href="https://mispy.me">Jaiden Mispy</a>. Dedicated to my trusty travel companion, <a href="/fizz.jpg">Fission the Jolteon</a>.</small><br/>
            <hr/>
            <small><a href="https://github.com/mispy/kanajolt">https://github.com/mispy/kanajolt</a></small>
        </div>
    }

    renderMobile() {
        const {showMenu} = this
        return <div className="app mobile">
            {showMenu ? this.renderMenu() : this.renderMain()}
            <nav>
                <button className="btn btn-light" onClick={action(e => this.showMenu = !this.showMenu)}>
                    {showMenu ? <svg aria-hidden="true" data-prefix="fas" data-icon="times" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512"><path fill="currentColor" d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg> : <svg aria-hidden="true" data-prefix="fas" data-icon="bars" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M16 132h416c8.837 0 16-7.163 16-16V76c0-8.837-7.163-16-16-16H16C7.163 60 0 67.163 0 76v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16zm0 160h416c8.837 0 16-7.163 16-16v-40c0-8.837-7.163-16-16-16H16c-8.837 0-16 7.163-16 16v40c0 8.837 7.163 16 16 16z"></path></svg>}
                </button>
            </nav>
        </div>
    }

    renderDesktop() {
        return <div className="app">
            {this.renderMenu()}
            {this.renderMain()}
        </div>
    }

    render() {
        return this.isMobile ? this.renderMobile() : this.renderDesktop()
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))