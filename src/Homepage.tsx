import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action, autorun, reaction} from 'mobx'
import {observer} from 'mobx-react'
import sample from 'lodash-es/sample'
import sampleSize from 'lodash-es/sampleSize'

declare const require: any
const TinyQueue = require('tinyqueue')

declare const window: any

const COLOR_EMPTY = "#333"
const COLOR_PLAYER = "lightgreen"
const COLOR_BARRIER = "cyan"
const COLOR_PILLAR = "orange"
const COLOR_TELEPORT = "yellow"
const COLOR_EXIT = "violet"
const COLOR_ENEMY = "red"

const TELEPORT_RANGE = 8
const REMINDER_FLOOR = 10
const FINAL_FLOOR = 12

const HEART: [number,number,number][] = [[0,0,0],[-1,0,1],[0,-1,1],[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,-1,2],[0,-2,2],[1,-2,1],[2,-2,0],[2,-1,-1],[2,0,-2],[1,1,-2],[0,2,-2],[-1,2,-1],[-2,2,0],[-2,1,1],[-2,-1,3],[-1,-2,3],[0,-3,3],[1,-3,2],[2,-3,1],[3,-3,0],[3,-2,-1],[3,-1,-2],[3,0,-3],[2,1,-3],[1,2,-3],[0,3,-3],[-1,3,-2],[-2,3,-1],[-3,3,0],[-3,2,1],[-3,1,2],[-2,-2,4],[-1,-3,4],[0,-4,4],[1,-4,3],[2,-4,2],[4,-1,-3],[4,0,-4],[3,1,-4],[-2,4,-2],[-3,4,-1],[-4,4,0],[-4,3,1],[-4,2,2]]

class PriorityQueue<T> {
    queue: any
    constructor() {
        this.queue = new TinyQueue([], (a: any, b: any) => a.priority - b.priority)
    }

    push(value: T, priority: number) {
        this.queue.push({ value, priority })
    }

    pop(): T {
        return this.queue.pop().value
    }

    get length(): number {
        return this.queue.length
    }
}

class Hex {
    static directions = [
        new Hex(+1, -1, 0), new Hex(+1, 0, -1), new Hex(0, +1, -1),
        new Hex(-1, +1, 0), new Hex(-1, 0, +1), new Hex(0, -1, +1)
    ]

    static zero = new Hex(0, 0, 0)

    static ring(center: Hex, radius: number): Hex[] {
        if (radius == 0) return [center]

        const results: Hex[] = []
        let hex = center.add(Hex.directions[4].scale(radius))
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < radius; j++) {
                results.push(hex)
                hex = hex.neighbor(i)
            }
        }
        return results
    }

    static rings(center: Hex, startRadius: number, endRadius: number) {
        const results = []
        for (let i = startRadius; i < endRadius; i++) {
            results.push(...Hex.ring(center, i))
        }
        return results
    }

    static distance(a: Hex, b: Hex) {
        return (Math.abs(a.q-b.q) + Math.abs(a.r-b.r) + Math.abs(a.s-b.s))/2
    }

    static lineBetween(a: Hex, b: Hex) {
        function lerp(a: number, b: number, t: number) {
            return a + (b - a) * t
        }

        function cubeLerp(a: Hex, b: Hex, t: number) {
            const x = lerp(a.q, b.q, t)
            const y = lerp(a.r, b.r, t)
            const z = lerp(a.s, b.s, t)

            let rx = Math.round(x)
            let ry = Math.round(y)
            let rz = Math.round(z)

            var x_diff = Math.abs(rx - x)
            var y_diff = Math.abs(ry - y)
            var z_diff = Math.abs(rz - z)
        
            if (x_diff > y_diff && x_diff > z_diff)
                rx = -ry-rz
            else if (y_diff > z_diff)
                ry = -rx-rz
            else
                rz = -rx-ry
        
            return new Hex(rx, ry, rz)            
        }

        const distance = Hex.distance(a, b)
        const line = []
        for (let i = 0; i < distance; i++) {
            line.push(cubeLerp(a, b, 1/distance * i))
        }
        line.push(b)

        return line
    }

    readonly q: number
    readonly r: number
    readonly s: number

    constructor(q: number, r: number, s: number) {
        console.assert(q + r + s == 0)
        this.q = q
        this.r = r
        this.s = s
    }

    add(b: Hex) {
        return new Hex(this.q+b.q, this.r+b.r, this.s+b.s)
    }

    scale(amount: number) {
        return new Hex(this.q*amount, this.r*amount, this.s*amount)
    }

    neighbor(index: number) {
        return this.add(Hex.directions[index])
    }

    equals(b: Hex) {
        return this.key === b.key
    }

    get neighbors() {
        return Hex.directions.map(hex => this.add(hex))
    }

    get key() {
        return `${this.q},${this.r},${this.s}`        
    }
}

class HexGrid<T> {
    @observable cells: Map<string, T> = new Map()

    constructor() {        
    }    

    get(hex: Hex): T {
        return this.cells.get(hex.key) as T
    }

    set(hex: Hex, value: T) {
        return this.cells.set(hex.key, value)
    }

    forEach(callback: (hex: Hex) => void) {
        return this.cells.forEach((val, key) => {
            const [q, r, s] = key.split(",").map(s => parseInt(s))
            callback(new Hex(q, r, s))
        })
    }
}

function hexagonPoints(cx: number, cy: number, size: number) {
    const path = []
    for (var i = 0; i < 6; i++) {
        const angle = Math.PI/180 * 60*i
        path.push(Math.round(cx+size*Math.cos(angle))+","+Math.round(cy+size*Math.sin(angle)))
    }
    return path
}

class Cell {
    game: Game
    hex: Hex
    @observable color = COLOR_EMPTY

    constructor(game: Game, hex: Hex) {
        this.game = game
        this.hex = hex
    }

    @computed get neighbors(): Cell[] {
        return this.hex.neighbors.map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }

    @computed get isPathable(): boolean {
        return this.color === COLOR_EMPTY
    }

    @computed get isEmpty(): boolean {
        return this.isPathable && this !== this.game.playerCell && !this.game.enemies.some(enemy => enemy.cell === this)
    }

    @computed get isSafe(): boolean {
        for (let enemy of this.game.enemies) {
            if (enemy.cell.neighbors.indexOf(this) !== -1)
                return false
        }

        return true
    }

    circle(radius: number): Cell[] {
        return Hex.rings(this.hex, 0, radius).map(hex => this.game.hexGrid.get(hex)).filter(cell => cell)
    }

    lineTo(b: Cell) {
        const cells = []
        for (let hex of Hex.lineBetween(this.hex, b.hex)) {
            const cell = this.game.hexGrid.get(hex)
            if (cell && cell.isPathable) {
                cells.push(cell)
            } else break;
        }
        return cells
    }

    pathTo(b: Cell) {
        return this.game.pathBetween(this, b)
    }
}

// player is green tile
// moves towards exit (white tile?)
// red tile enemies
// create blue tile barriers to block path of enemies

class Enemy {
    game: Game
    @observable cell: Cell

    constructor(game: Game, cell: Cell) {
        this.game = game
        this.cell = cell
    }

    @computed get isDefeated(): boolean {
        return this.cell.pathTo(this.game.playerCell).length == 0
    }
}

class Game {
    @observable playerCell: Cell
    @observable exitCell: Cell
    @observable teleportCrystal?: Cell
    @observable enemies: Enemy[] = []
    @observable numTeleports: number = 0
    @observable floor: number
    @observable state: 'game'|'success'|'failure'|'stuck'|'final' = 'game'

    @computed get numEnemies(): number {
        return this.floor
    }

    @computed get ringSize() { return 8 }

    @computed get ringHexes() {
        const {ringSize} = this
        return Hex.rings(Hex.zero, 0, ringSize)
    }

    @computed get cells(): Cell[] {
        return this.ringHexes.map(hex => this.hexGrid.get(hex) as Cell)
    }

    @computed get isSafe(): boolean {
        return this.enemies.every(enemy => enemy.isDefeated)
    }

    @computed get isEndgame(): boolean {
        return this.floor === FINAL_FLOOR
    }

    hexGrid: HexGrid<Cell>
    constructor() {
        reaction(
            () => this.floor,
            this.setupBoard
        )

        this.hexGrid = new HexGrid<Cell>()
        this.ringHexes.forEach(hex => this.hexGrid.set(hex, new Cell(this, hex)))

        this.resetGame()
    }

    @action.bound resetGame() {
        this.floor = 1
        this.numTeleports = 0
        this.setupBoard()
    }

    @action.bound setupBoard() {
        this.cells.forEach(cell => cell.color = COLOR_EMPTY)
        this.teleportCrystal = undefined
        this.exitCell = this.hexGrid.get(new Hex(-6, 0, 6))
        this.playerCell = this.hexGrid.get(new Hex(6, 0, -6))
        this.enemies = []

        if (this.isEndgame) {
            this.exitCell = this.hexGrid.get(new Hex(0, 0, 0))
            return
        }

        const pillarHexes = Hex.rings(Hex.zero, sample([0, 1]) as number, sample([2, 3]) as number)
        pillarHexes.forEach(hex => this.hexGrid.get(hex).color = COLOR_PILLAR)

        const playerNeighbors = this.playerCell.neighbors
        let spawnableCells = this.cells.filter(cell => cell.isEmpty && cell !== this.exitCell && playerNeighbors.indexOf(cell) === -1)
        spawnableCells = sampleSize(spawnableCells, spawnableCells.length)

        this.teleportCrystal = spawnableCells.pop()
        for (let i = 0; i < this.numEnemies; i++) {
            const cell = spawnableCells.pop()
            if (cell !== undefined)
                this.enemies.push(new Enemy(this, cell))
        }
    }

    @action.bound nextFloor() {
        if (this.state == 'success')
            this.floor += 1
        else {
            this.resetGame()
        }
        this.state = 'game'
    }

    pathBetween(start: Cell, goal: Cell): Cell[] {
        const frontier = new PriorityQueue<Cell>()
        frontier.push(start, 0)
        const cameFrom: Map<Cell, Cell|undefined> = new Map()
        const costSoFar: Map<Cell, number> = new Map()
        cameFrom.set(start, undefined)
        costSoFar.set(start, 0)

        while (frontier.length > 0) {
            const current = frontier.pop()

            if (current === goal)
                break;

            current.neighbors.forEach(nextCell => {
                if (nextCell !== start && nextCell !== goal && !nextCell.isPathable) return

                const newCost = (costSoFar.get(current)||0) + 1
                const prevCost = costSoFar.get(nextCell)
                if (prevCost === undefined || newCost < prevCost) {
                    costSoFar.set(nextCell, newCost)
                    frontier.push(nextCell, newCost)
                    cameFrom.set(nextCell, current)
                }
            })
        }

        if (!cameFrom.has(goal))
            return []
        else {
            const path = []
            let current = goal
            while (current != start) {
                path.push(current)
                current = cameFrom.get(current) as Cell
            }
            path.reverse()
            return path
        }
    }

    @action.bound placeBarrier(start: Cell, end: Cell) {
        start.lineTo(end).forEach(cell => {
            cell.color = COLOR_BARRIER
        })
    }

    endTurn() {
        if (this.playerCell === this.teleportCrystal) {
            this.numTeleports += 1
            this.teleportCrystal = undefined
        }

        if (this.playerCell === this.exitCell) {
            this.state = this.isEndgame ? 'final' : 'success'
            return
        }

        for (let enemy of this.enemies) {
            const path = this.pathBetween(enemy.cell, this.playerCell)
            if (path.length && (path[0] === this.playerCell || path[0].isEmpty))
                enemy.cell = path[0]

            if (enemy.cell === this.playerCell) {
                this.state = 'failure'
                return
            }
        }

        if (this.numTeleports === 0 && this.pathBetween(this.playerCell, this.exitCell).length === 0) {
            this.state = 'stuck'
            return
        }
    }
}

class Tile extends React.Component<{ fill: string, cell: Cell, view: GameView, opacity?: number, stroke?: string, strokeWidth?: number }> {
    render() {
        const {fill, cell, view, ...rest} = this.props
        return <polygon points={view.hexToPolygon(cell.hex)} fill={fill} stroke="#000" strokeWidth={view.hexRadius/8} onMouseDown={e => view.onMouseDown(cell)} onMouseMove={e => view.onMouseMove(cell)} onMouseUp={e => view.onMouseUp(cell)} {...rest}/>
    }
}

const Span = (props: { color: string, children: any }) => {
    return <span style={{ color: props.color }}>{props.children}</span>
}

@observer
class GameView extends React.Component<{ width: number, height: number }> {
    game: Game = new Game()
    @computed get hexRadius() { return Math.round(Math.min(this.props.width-50, this.props.height-250)/((this.game.ringSize+5)*2)) }
    @computed get boardWidth() { return this.hexRadius*(this.game.ringSize+5)*2 }
    @computed get boardHeight() { return this.hexRadius*(this.game.ringSize+6)*2 }
    @computed get boardCenterX() { return this.boardWidth/2 }
    @computed get boardCenterY() { return this.boardHeight/2 }

    @observable selectedAbility?: 'barrier'|'teleport'
    @observable isHelping: boolean = false

    @observable isMouseDown: boolean = false
    @observable currentSelection: Cell[] = []
    @observable pathTarget: Hex

    @observable barrierStart?: Cell
    @observable cursor?: Cell

    @action.bound finishBarrier() {
        if (!this.barrierStart || !this.cursor) return
        this.game.placeBarrier(this.barrierStart, this.cursor)
        this.barrierStart = undefined
        this.toggleSelectBarrier()
        this.game.endTurn()
    }

    @action.bound onMouseDown(cell: Cell) {
        this.isMouseDown = true

        if (this.selectedAbility === 'teleport') {
            const cells = this.game.playerCell.circle(TELEPORT_RANGE)
            if (cells.indexOf(cell) !== -1) {
                this.game.playerCell = cell
                this.selectedAbility = undefined
                this.game.numTeleports -= 1
                this.game.endTurn()
            }
        } else if (this.selectedAbility === 'barrier') {
            if (this.barrierStart === undefined)
                this.barrierStart = this.cursor
            else {
                this.finishBarrier()
            }
        } else {
            const path = this.game.pathBetween(this.game.playerCell, cell)
            if (path.length) {
                if (this.game.isSafe && !this.game.isEndgame && (cell === this.game.teleportCrystal || cell === this.game.exitCell)) {
                    // Fast move when safe
                    this.game.playerCell = cell
                    this.game.endTurn()
                } else if (path[0].isEmpty) {
                    this.game.playerCell = path[0]
                    this.game.endTurn()
                }
            }
        }
    }

    @action.bound onMouseMove(cell: Cell) {
        this.cursor = cell
    }

    @action.bound onMouseUp(cell: Cell) {
        if (this.isMouseDown && this.barrierStart && this.barrierStart !== this.cursor)
            this.finishBarrier()

        this.isMouseDown = false
    }

    hexToPolygon(hex: Hex): string {
        const {boardCenterX, boardCenterY, hexRadius} = this
        const screenX = boardCenterX + hexRadius * 3/2 * hex.r
        const screenY = boardCenterY + hexRadius * Math.sqrt(3) * (hex.q + hex.r/2)
        return hexagonPoints(screenX, screenY, hexRadius).join(" ")
    }

    renderTerrain() {
        const {game} = this

        return game.cells.map(cell => {
            const isSelected = this.currentSelection.indexOf(cell) !== -1
            const isPlayer = cell === game.playerCell
            return <Tile fill={cell.color} stroke={"#000"} strokeWidth={this.hexRadius/8} cell={cell} view={this}/>
        })
    }

    renderPlayer() {
        return <Tile fill={COLOR_PLAYER} cell={this.game.playerCell} view={this}/>
    }

    renderExit() {
        return <Tile fill={this.game.isEndgame ? COLOR_PLAYER : COLOR_EXIT} cell={this.game.exitCell} view={this}/>
    }

    renderEnemies() {
        return this.game.enemies.map(enemy => {
            return <Tile fill={COLOR_ENEMY} cell={enemy.cell} view={this}/>
        })
    }

    renderEnemyPaths() {
        const tiles: JSX.Element[] = []
        this.game.enemies.forEach(enemy => {
            const path = enemy.cell.pathTo(this.game.playerCell)
            path.slice(0, -1).forEach(cell => tiles.push(
                <Tile fill={COLOR_ENEMY} opacity={0.05} cell={cell} view={this}/>
            ))
        })
        return tiles
    }

    renderTargetTeleport() {
        const cells = this.game.playerCell.circle(TELEPORT_RANGE).filter(cell => cell.isEmpty)

        return cells.map(cell => {
            return <Tile fill={cell === this.cursor ? COLOR_PLAYER : "yellow"} opacity={cell === this.cursor ? 0.8 : 0.5} cell={cell} view={this}/>
        })
    }

    renderEndState() {
        const {game} = this
        if (game.state == 'success') {
            const nextFloor = game.floor+1
            return <div id="game" className="continue success">
                <h2>Floor {nextFloor}</h2>
                {nextFloor === REMINDER_FLOOR && <div>
                    <p>The spire's hum of activity reaches a feverish pitch, and ever more <Span color={COLOR_ENEMY}>chaos</Span> swarms ahead.</p>
                    <p>You would really prefer to leave and go soak your etherfronds in a nice spirit lake.</p>
                    <p>But ahead, barely perceptible through the rising din, you hear a <Span color={COLOR_PLAYER}>familiar mindsong</Span>...</p>
                </div>}
                <div id="abilities">
                    <button onClick={e => game.nextFloor()}>Continue</button>
                </div>
            </div>
        } else if (game.state == 'stuck') {
            return <div id="game" className="continue stuck">
                <h2>You got... stuck?</h2>
                <div id="abilities">
                    <button onClick={e => game.nextFloor()}>Restart</button>
                </div>
                </div>
        } else {
            return <div id="game" className="continue failure">
                <h2>You were captured...</h2>
                <div id="abilities">
                    <button onClick={e => game.nextFloor()}>Restart</button>
                </div>
            </div>
        }
    }

    renderTargetBarrier() {
        if (!this.cursor) return
        const barrierCells = this.barrierStart ? this.barrierStart.lineTo(this.cursor) : [this.cursor]
        return barrierCells.filter(cell => cell.isEmpty).map(cell => {
            return <Tile fill={COLOR_BARRIER} opacity={0.5} cell={cell} view={this}/> 
        })
    }

    renderCrystal() {
        return this.game.teleportCrystal && <Tile fill={COLOR_TELEPORT} cell={this.game.teleportCrystal} view={this}/>
    }

    renderHoverInfo() {
        if (this.selectedAbility !== undefined) return

        const hoveredEnemy = this.game.enemies.find(enemy => enemy.cell === this.cursor)
        if (hoveredEnemy) {
            const path = hoveredEnemy.cell.pathTo(this.game.playerCell)
            return path.map(cell =>
                <Tile fill={COLOR_ENEMY} opacity={0.5} cell={cell} view={this}/>                    
            )
        } else if (this.cursor && (this.cursor === this.game.exitCell || this.cursor === this.game.teleportCrystal)) {
            const path = this.game.playerCell.pathTo(this.cursor)
            let tiles = path.map(cell => {
                let color = "orange"
                if (this.game.isSafe)
                    color = COLOR_PLAYER
                else if (!cell.isSafe)
                    color = COLOR_ENEMY
                return <Tile fill={color} opacity={0.1} cell={cell} view={this}/>
            })

            return tiles
        }
    }

    renderHeart() {
        return HEART.map(coords => {
            const cell = this.game.hexGrid.get(new Hex(coords[0], coords[1], coords[2]))
            return <Tile fill={COLOR_PLAYER} cell={cell} view={this}/>
        })
    }

    @action.bound toggleSelectBarrier() {
        this.selectedAbility = this.selectedAbility === 'barrier' ? undefined : 'barrier'
        this.barrierStart = undefined
    }

    @action.bound toggleSelectTeleport() {
        this.selectedAbility = this.selectedAbility === 'teleport' ? undefined : 'teleport'
    }
    
    @action.bound onMouseLeave() {
        this.cursor = undefined
    }

    renderAbilities() {
        const {game} = this

        if (game.state === 'final')
            return <div id="abilities">
                <button onClick={e => game.nextFloor()}>Restart</button>
            </div>

        return <div id="abilities">
            <button className={"barrier" + (this.selectedAbility === 'barrier' ? ' active' : "")} onClick={e => this.toggleSelectBarrier() } disabled={game.isEndgame}>{this.selectedAbility === 'barrier' ? (this.barrierStart ? "Place End" : "Place Start") : "Barrier Wall"}</button>
            <button className={"teleport" + (this.selectedAbility === 'teleport' ? ' active' : "")} onClick={e => this.toggleSelectTeleport() } disabled={game.isEndgame || game.numTeleports == 0}>Teleport x{game.numTeleports}</button>
            <button className={"help" + (this.isHelping? ' active' : "")} onClick={e => this.isHelping = !this.isHelping} disabled={game.isEndgame}>Help</button>
        </div>
    }

    render() {
        const {props, boardWidth, boardHeight, boardCenterX, boardCenterY, hexRadius, game} = this

        window.game = game
        window.gameView = this

        if (game.state !== 'game' && game.state !== 'final') {
            return this.renderEndState()
        }

        return <div id="game">
            {this.isHelping && <div className="help">
                <h1>Spire of the Path</h1>
                <p>A vast spire looms before you. You are a <Span color={COLOR_PLAYER}>luminous psionic being</Span> and you wish to ascend the spire, to search for a mystical artifact or rescue a cute guy or something.</p>
                <p>On each floor you must reach the <Span color={COLOR_EXIT}>exit portal</Span> that leads to the next.</p>
                <p>Your way is impeded by <Span color={COLOR_PILLAR}>ominous pillars</Span> and <Span color={COLOR_ENEMY}>chaotic entities</Span> who will try to capture you for their own nefarious ends. Watch out!</p>
                <p>Fortunately, you have mastered the art of weaving <Span color={COLOR_BARRIER}>psionic barriers</Span> to form defensive walls. But be careful not to block your own path...</p>
                <p>Throughout the spire you will find single-use <Span color={COLOR_TELEPORT}>teleport crystals</Span>. These are helpful friends!</p>
                <button onClick={e => this.isHelping = false}>Continue</button>
                <hr/>
                <small>This little game was made over the weekend by <a href="https://mispy.me/">Jaiden Mispy</a>. You may peek at the <a href="https://github.com/mispy/spirepath">source code</a>.</small>
            </div>}
            <h2>Floor {game.floor}</h2>
            <svg width={boardWidth} height={boardHeight} onMouseLeave={this.onMouseLeave}>
                {this.renderTerrain()}
                {this.renderEnemyPaths()}
                {this.renderPlayer()}
                {this.renderExit()}
                {this.renderCrystal()}
                {this.renderEnemies()}
                {this.renderHoverInfo()}
                {this.selectedAbility === 'barrier' && this.renderTargetBarrier()}
                {this.selectedAbility === 'teleport' && this.renderTargetTeleport()}
                {this.game.state == 'final' && this.renderHeart()}
            </svg>
            {this.renderAbilities()}
        </div>
    }
}

window.homepageStart = function() {
    function render() {
        ReactDOM.render(<GameView width={window.innerWidth} height={window.innerHeight} />, document.querySelector("main"))
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
