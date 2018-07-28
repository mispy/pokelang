import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed, autorun, reaction, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
declare const require: any
const wanakana = require('wanakana')

import * as pokenames from './pokenames'
import './index.scss'

declare const window: any
window.wanakana = wanakana
window.pokenames = pokenames

const MNEMONICS = {
    "ん": "looks just like the English alphabet '<b>n</b>'"
}

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

function splitKana(jp: string): string[] {
    const kana = []

    const beforeModifiers = ["ッ", "っ"]
    const afterModifiers = ["ー", "ャ", "ョ", "ュ", "ェ",
                                  "ゃ", "ょ", "ゅ", "ぇ"]
    
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
        </div>
    }
}

class GameState {
    @observable questionIndex: number = 0
    @observable hintCount: number = 0
    @observable kanaIndex: number = 0
    @observable kanaMode: 'katakana'|'hiragana'|'both' = 'katakana'
    @observable streakCounter: number = 0
    @observable bestStreak: number = 0
    @observable charactersSeen: { [key: string]: boolean } = {}

    save() {
        localStorage.setItem('kanajolt', JSON.stringify(this))
    }

    @action.bound load() {
        const save = JSON.parse(localStorage.getItem('kanajolt') || "{}")
        for (const key in this) {
            if (key in save)
                this[key] = save[key]
        }
    }

    @action.bound clearSave() {
        const newGame = new GameState()
        newGame.save()
        this.load()
    }
}

function getFauxBBox(path: SVGPathElement) {
  const pathlen = path.getTotalLength()
  const step = pathlen/100
  
  let left = 0
  let top = 0
  let right = 0
  let bottom = 0

  for (let i = 0; i < 100; i++) {
    const point = path.getPointAtLength(step*i)
    if (point.x < left) left = point.x
    if (point.x > right) right = point.x
    if (point.y < top) top = point.y
    if (point.y > bottom) bottom = point.y
  }

  return { left: left, top: top, right: right, bottom: bottom, width: right-left, height: bottom-top }
}

@observer
class Ending extends React.Component {
    base: HTMLDivElement

    componentDidMount() {
        window.addEventListener('resize', this.reposition)
        this.reposition()
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.reposition)
    }

    @action.bound reposition() {
        const pathSpec = "M 297.29747,550.86823 C 283.52243,535.43191 249.1268,505.33855 220.86277,483.99412 C 137.11867,420.75228 125.72108,411.5999 91.719238,380.29088 C 29.03471,322.57071 2.413622,264.58086 2.5048478,185.95124 C 2.5493594,147.56739 5.1656152,132.77929 15.914734,110.15398 C 34.151433,71.768267 61.014996,43.244667 95.360052,25.799457 C 119.68545,13.443675 131.6827,7.9542046 172.30448,7.7296236 C 214.79777,7.4947896 223.74311,12.449347 248.73919,26.181459 C 279.1637,42.895777 310.47909,78.617167 316.95242,103.99205 L 320.95052,119.66445 L 330.81015,98.079942 C 386.52632,-23.892986 564.40851,-22.06811 626.31244,101.11153 C 645.95011,140.18758 648.10608,223.6247 630.69256,270.6244 C 607.97729,331.93377 565.31255,378.67493 466.68622,450.30098 C 402.0054,497.27462 328.80148,568.34684 323.70555,578.32901 C 317.79007,589.91654 323.42339,580.14491 297.29747,550.86823 z"

        const path = document.createElementNS("http://www.w3.org/2000/svg", 'path')
        path.setAttribute('d', pathSpec)
        path.style['strokeWidth'] = '2'
        path.style['stroke'] = 'none'
        path.style['fill'] = 'none'
    
        const length = path.getTotalLength()
        const bbox = getFauxBBox(path)

        const bounds = (this.base.parentNode as any).getBoundingClientRect()
        const scale = Math.min(bounds.width/bbox.width, bounds.height/bbox.height)*0.8

        const targetWidth = bbox.width*scale
        const targetHeight = bbox.height*scale

        this.base.style['width'] = `${targetWidth}px`
        this.base.style['height'] = `${targetHeight}px`

        const imgs = this.base.querySelectorAll("img")
        const interdist = length / imgs.length
        for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i]
            const dest = path.getPointAtLength(i*interdist)

            const tx = (scale * dest.x - 16)
            const ty = (scale * dest.y - 16)
            img.style.left = `${tx}px`
            img.style.top = `${ty}px`
        }
    }

    render() {
        return <div className="ending" ref={e => this.base = (e as any)}>
            {_.range(0, 50).map(i => {
                return <img style={{ position: 'absolute', left: 0, top: 0}} src="../overworld/right/135.png"/>
            })}
            <div>
                <p>おめでとうございます!</p>
            </div>
        </div>
    }
}

@observer
class Main extends React.Component {
    game: GameState = new GameState()
    @observable showMenu: boolean = false
    @observable isMobile: boolean = false
    @observable isTransition: boolean = false
    inputBuffer: string = ""
    pokeDiv: HTMLDivElement
    pokeCry: HTMLAudioElement

    @observable wrongChoices: string[] = []

    // The list of pokemon in order to show
    @computed get pokeList() {
        const pokes = _.range(1, MAX_POKEMON+1)
        pokes.splice(pokes.indexOf(135), 1)
        return [135].concat(pokes)
    }

    @computed get pokeIndex(): number {
        return this.game.questionIndex
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

    get questionKanaMode() {
        if (this.game.kanaMode === 'both')
            return (Math.random() > 0.5 ? "hiragana" : "katakana")
        else
            return this.game.kanaMode
    }

    @computed get japaneseName(): string {
        const katakana = pokenames.ja[this.poke-1]
        if (!katakana) return ""

        // TODO fix extends in hiragana
        if (this.questionKanaMode === "hiragana")
            return wanakana.toHiragana(katakana)
        else
            return katakana
    }

    @computed get kana(): string[] {
        return splitKana(this.japaneseName)
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
        return _.sortBy(_.sampleSize(this.optionSet, 3).concat([this.correctOption]))
    }

    @computed get numNamed(): number {
        return this.game.questionIndex
    }

    @computed get hint() {
        if (this.isTransition) return undefined

        if (this.game.questionIndex === 0 && this.correctOption === "sa")
            return [
                <p>The first character of Jolteon's name in Japanese is "sa" ({this.currentKana}). Each time you see a new character, we'll show you the correct answer.</p>,
                <p>Choose the option "sa" above to continue.</p>
            ]
        else if (this.game.questionIndex === 0 && this.correctOption === "n")
            return [
                <p>The second character is "n" ({this.currentKana}). This is the only kana character that represents a single consonant rather than a syllable.</p>,
            ]
        else if (this.game.questionIndex === 0 && this.correctOption === "daa")
            return [
                <p>The third and fourth characters together make "daa" ({this.currentKana}). Some characters affect how others are read contextually, such as the long-vowel mark "ー".</p>,
            ]
        else if (this.game.questionIndex === 0 && this.correctOption === "su")
            return [
                <p>The final character is "su" ({this.currentKana}), giving us "Sandaasu" or... "Thunders". Many Pokémon names are really English loanwords!</p>,
                <p>There are 493 Pokémon for you to name in total, all of the 4th generation. Good luck!</p>
            ]
        else if (!this.game.charactersSeen[this.currentKana])
            return <p>New {this.questionKanaMode}: {this.currentKana} {wanakana.toRomaji(this.currentKana)}</p>
        else if (this.wrongChoices.length)
            return <p>Hint: {this.currentKana} {wanakana.toRomaji(this.currentKana)}</p>
        else
            return undefined
    }

    @computed get isEnding(): boolean {
        return this.game.questionIndex >= this.pokeList.length
    }

    @action.bound chooseOption(option: string) {
        if (option === this.correctOption) {
            this.game.charactersSeen[this.currentKana] = true
            this.game.kanaIndex += 1
            this.wrongChoices = []
        } else {
            this.game.streakCounter = -1
            this.wrongChoices.push(option)
        }

        if (this.game.kanaIndex >= this.kana.length) {
            this.onComplete()
        }
    }

    @action.bound onComplete() {
        this.game.streakCounter += 1
        if (this.game.streakCounter > this.game.bestStreak)
            this.game.bestStreak = this.game.streakCounter

        this.pokeCry.volume = 0.05
        this.pokeCry.play()
        this.isTransition = true
        setTimeout(this.finishTransition, 1000)
    }

    @action.bound finishTransition() {
        this.isTransition = false
        this.game.questionIndex += 1
        this.game.kanaIndex = 0
    }

    @action.bound onResize() {
        this.isMobile = window.innerWidth < 700
    }

    // It's a bit slower to click on things than to tap them, so for
    // PC we also support keyboard input
    @action.bound onKeydown(e: KeyboardEvent) {
        // Choose option by number
        const num = parseInt(e.key)
        if (!isNaN(num) && num > 0 && num <= this.options.length) {
            this.chooseOption(this.options[num-1])
        } else if (isNaN(num)) {
            this.inputBuffer += e.key
            const maxLength = _.max(this.options.map(opt => opt.length)) as number
            if (_.some(this.options, option => option === this.inputBuffer)) {
                this.chooseOption(this.inputBuffer)
                this.inputBuffer = ""
            } else if (this.inputBuffer.length > maxLength) {
                this.inputBuffer = ""
            }
        }
    }

    dispose: IReactionDisposer
    componentDidMount() {
        this.onResize()
        window.addEventListener("resize", this.onResize)
        window.game = this.game

        window.addEventListener("keydown", this.onKeydown)

        this.game.load()
        this.dispose = autorun(() => this.game.save())

        this.componentDidUpdate()


        autorun(() => { 
            // Preload the cry for the current pokemon before we need to play it
            if (this.poke)
                this.pokeCry = new Audio(`cries/${this.poke}.ogg`)
        })
    }

    componentDidUpdate() {
        if (wanakana.toRomaji(this.currentKana) === this.currentKana) {
            // Skip things that are not really kana, like ♂
            this.chooseOption(this.correctOption)
        }        
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onResize)
        this.dispose()
    }
    
    renderMain() {
        if (this.isEnding)
            return <main><Ending/></main>
        const {poke, prevPoke, nextPoke, kana, options, currentKana, wrongChoices, numNamed, hint} = this
        const {game} = this
        const {kanaIndex, streakCounter} = this.game

        return <main className={this.isTransition ? "questionTransition" : undefined}>
            <div className="container text-center">
                <div className="runway">
                    <Pokemon number={poke} key={game.questionIndex} shakeCount={wrongChoices.length}/>
                    <PokemonPreloader poke={poke}/>
                    {prevPoke && <Pokemon number={prevPoke} out={true} key={`prev-${game.questionIndex}`}/>}
                    {nextPoke && <Pokemon number={nextPoke} key={`next-${game.questionIndex}`} hidden={true}/>}
                    {nextPoke && <PokemonPreloader poke={nextPoke}/>}
                </div>
                {!this.isTransition && <div className="pokename">{kana.map((k, i) => 
                    <span className={`kana${i === kanaIndex ? " current" : ""}`}>
                        {k}
                        {i < kanaIndex && <span className="answer">{wanakana.toRomaji(k)}</span>}
                    </span>
                )}<br/>&nbsp;</div>}
                {this.isTransition && <div className="pokename text-success">
                    <div>{this.japaneseName}<br/>{wanakana.toRomaji(this.japaneseName)}</div>
                </div>}
                <div className={`options${this.isTransition ? " hidden" : ""}`}>
                    {options.map((option, i) => 
                        <button className="btn btn-light text-secondary romaji" onClick={e => this.chooseOption(option)} disabled={_.includes(wrongChoices, option)}><span>{i+1} </span>{option}</button>
                    )}
                </div>
                <div className="stats">
                    <div className={game.streakCounter < 2 ? 'hidden' : ''}>
                        <div className={game.streakCounter > 1 ? "text-success" : "text-secondary"}>Streak: {streakCounter}</div>
                    </div>
                </div>
                <div className="hint">
                    {hint}
                </div>
            </div>
        </main>
    }

    renderMenu() {
        const {game} = this
        return <div className="menu">
            <section className="description">
                <h1>Kanajolt</h1>
                <p>Jolteon and his Pokémon friends are traveling the world to learn new languages. Can you help them to read their Japanese names by learning each of the characters?</p>
            </section>
            <hr/>
            <section className="settings">
                <p>Pokémon names are traditionally written in <a href="https://en.wikipedia.org/wiki/Katakana">katakana</a>, the syllabary used for loanwords, technical terms and emphasis. For learning purposes, you can allow them to appear in <a href="https://en.wikipedia.org/wiki/Hiragana">hiragana</a> as well.</p>
                <div className="pretty p-default p-round">
                    <input type="radio" id="katakana" checked={game.kanaMode === "katakana"} onChange={action(() => game.kanaMode = 'katakana')}/>
                    <div className="state p-success">
                        <label htmlFor="katakana">Katakana</label>
                    </div>
                </div>
                <div className="pretty p-default p-round">
                    <input type="radio" id="hiragana" checked={game.kanaMode === "hiragana"} onChange={action(() => game.kanaMode = 'hiragana')}/>
                    <div className="state p-success">
                        <label htmlFor="hiragana">Hiragana</label>
                    </div>
                </div>
                <div className="pretty p-default p-round">
                    <input type="radio" id="bothkana" checked={game.kanaMode === "both"} onChange={action(() => game.kanaMode = 'both')}/>
                    <div className="state p-success">
                        <label htmlFor="bothkana">Both</label>
                    </div>
                </div>
                <hr/>
                <p>Your progress is saved automatically on the device you are using.</p>
                <div className="clearSave">
                    <span>Named: {this.game.questionIndex}</span> <button className="btn btn-warning" onClick={this.game.clearSave}>{this.isEnding ? "New Game" : "Reset Game"}</button>
                </div>
            </section>
            <hr/>
            <section className="about">
                <small>Created by <a href="https://mispy.me">Jaiden Mispy</a>. Dedicated to my trusty travel companion, <a href="/fizz.jpg">Fission the Jolteon</a>.</small><br/>
                <hr/>
                <small><a href="https://github.com/mispy/kanajolt">https://github.com/mispy/kanajolt</a></small>
            </section>
        </div>
    }

    renderMobile() {
        const {showMenu} = this
        return <div className="app mobile">
            <div className="contents">
                <header>
                    <h1>Kanajolt</h1>
                    <p>Learn kana by naming the Pokémon</p>
                </header>
                {this.renderMain()}
                {showMenu && this.renderMenu()}
            </div>
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