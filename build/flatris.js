var Flatris = {
  COLORS: {
    I: '#3cc7d6',
    O: '#fbb414',
    T: '#b04497',
    J: '#3993d0',
    L: '#ed652f',
    S: '#95c43d',
    Z: '#e84138'
  },
  // The Shapes and their rotation was inspired from
  // http://tetris.wikia.com/wiki/SRS
  SHAPES: {
    I: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0]
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ]
  },
  WELL_ROWS: 20,
  WELL_COLS: 10,
  DROP_FRAMES_DEFAULT: 48,
  DROP_FRAMES_DECREMENT: 1.5,
  DROP_FRAMES_ACCELERATED: 1.5,
  LINE_CLEAR_BONUSES: [100, 300, 500, 800, 1100, 1500, 1900, 2500, 3200, 4000],
  KEYS: {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39
  },
  attachPointerDownEvent: function(eventHandler) {
    if (this.isMobileDevice()) {
      return {onTouchStart: eventHandler};
    } else {
      return {onMouseDown: eventHandler};
    }
  },
  attachPointerUpEvent: function(eventHandler) {
    if (this.isMobileDevice()) {
      return {onTouchEnd: eventHandler};
    } else {
      return {onMouseUp: eventHandler};
    }
  },
  isMobileDevice: function() {
    return 'ontouchstart' in window;
  }
};

/** @jsx React.DOM */

Cosmos.components.FlatrisStatePersistor = React.createClass({displayName: 'FlatrisStatePersistor',
  /**
   * Persist Flatris state with local storage.
   */
  mixins: [Cosmos.mixins.PersistState],
  children: {
    flatrisStatePreview: function() {
      // Unload previous state from local storage if present, otherwise
      // generate a blank Flatris instance
      var prevState = localStorage.getItem('flatrisState');
      if (prevState) {
        return JSON.parse(prevState);
      } else {
        return {
          component: 'FlatrisStatePreview'
        };
      }
    }
  },
  componentDidMount: function() {
    $(window).on('unload', this.onUnload);
  },
  componentWillUnmount: function() {
    $(window).off('unload', this.onUnload);
  },
  render: function() {
    return this.loadChild('flatrisStatePreview');
  },
  onUnload: function() {
    var snapshot = this.refs.flatrisStatePreview.generateSnapshot(true);
    localStorage.setItem('flatrisState', JSON.stringify(snapshot));
  }
});

/** @jsx React.DOM */

Cosmos.components.FlatrisStatePreview = React.createClass({displayName: 'FlatrisStatePreview',
  /**
   * Render a Flatris instance next to its prettified, serialized state
   */
  mixins: [Cosmos.mixins.PersistState],
  getInitialState: function() {
    return {
      shapshot: '{}'
    };
  },
  children: {
    flatris: function() {
      return {
        component: 'Flatris'
      };
    }
  },
  render: function() {
    return (
      React.DOM.div( {className:"flatris-state-preview"}, 
        this.loadChild('flatris'),
        React.DOM.pre( {className:"state-preview"}, this.state.snapshot)
      )
    );
  },
  componentDidMount: function() {
    this.refreshSnapshot();
    this._intervalId = setInterval(this.refreshSnapshot, 200);
  },
  componentWillUnmount: function() {
    clearInterval(this._intervalId);
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    // No need to render for an identical snapshot
    return nextState.snapshot != this.state.snapshot;
  },
  refreshSnapshot: function() {
    this.setState({
      snapshot: this.serializeState(this.refs.flatris.generateSnapshot(true))
    });
  },
  serializeState: function(snapshot) {
    /**
     * This ugly method styles the indenting of the stringified state JSON.
     */
    var snapshot = JSON.stringify(snapshot, null, '  ');
    // Style the Well and the active Tetrimino grid with one row per line
    snapshot = snapshot.replace(/\n([\s]+)"grid"\: ([\s\S]+?)\]([\s]+)\]/g,
      function(match, indent, grid, after) {
        grid = grid.replace(new RegExp('\\[\n' + indent + '    ', 'g'), '[');
        grid = grid.replace(new RegExp(',\n' + indent + '    ', 'g'), ', ');
        grid = grid.replace(new RegExp('\n' + indent + '  (\\]|$)', 'g'), '$1');
        return '\n' + indent + '"grid": ' + grid + ']' + after + ']';
      }
    );
    return snapshot;
  }
});

/** @jsx React.DOM */

Cosmos.components.Flatris = React.createClass({displayName: 'Flatris',
  /**
   * The Tetris game was originally designed and programmed by Alexey Pajitnov.
   * It was released on June 6, 1984 and has since become a world-wide
   * phenomenon. Read more about the game at http://en.wikipedia.org/wiki/Tetris
   */
  getInitialState: function() {
    return _.extend(this.getNewGameDefaults(), {
      // Game is stopped by default and there's no Tetrimino to follow
      playing: false,
      nextTetrimino: null
    });
  },
  getNewGameDefaults: function() {
    return {
      playing: true,
      paused: true,
      score: 0,
      lines: 0,
      nextTetrimino: this.getRandomTetriminoType()
    };
  },
  mixins: [Cosmos.mixins.PersistState],
  children: {
    well: function() {
      return {
        component: 'Well',
        onTetriminoLanding: this.onTetriminoLanding,
        onFullWell: this.onFullWell
      };
    }
  },
  start: function() {
    /**
     * Start or restart a Flatris session from scratch.
     */
    var newGameDefaults = this.getNewGameDefaults();
    this.setState(newGameDefaults);
    this.refs.well.reset();
    // setState is always synchronous so we can't read the next Tetrimino from
    // .state.nextTetrimino at this point
    this.insertNextTetriminoInWell(newGameDefaults.nextTetrimino);
    this.resume();
  },
  pause: function() {
    this.setState({paused: true});
    this.refs.well.stopAnimationLoop();
    // Stop any on-going acceleration inside the Well
    this.refs.well.setState({dropAcceleration: false});
  },
  resume: function() {
    this.setState({paused: false});
    this.refs.well.startAnimationLoop();
  },
  render: function() {
    return (
      React.DOM.div( {className:"flatris"}, 
        this.loadChild('well'),
        this.renderInfoPanel(),
        Cosmos(this.getGamePanelProps()),
        React.DOM.div( {className:"controls"}, 
          React.DOM.button(
            Flatris.attachPointerDownEvent(this.onRotatePress), '↻'),
          React.DOM.button(
            Flatris.attachPointerDownEvent(this.onLeftPress), '←'),
          React.DOM.button(
            Flatris.attachPointerDownEvent(this.onRightPress), '→'),
          React.DOM.button(
            _.extend(
              Flatris.attachPointerDownEvent(this.onPullPress),
              Flatris.attachPointerUpEvent(this.onPullRelease)), '↓')
        )
      )
    );
  },
  getGamePanelProps: function() {
    return {
      component: 'GamePanel',
      playing: this.state.playing,
      paused: this.state.paused,
      score: this.state.score,
      lines: this.state.lines,
      nextTetrimino: this.state.nextTetrimino,
      onPressStart: this.start,
      onPressPause: this.pause,
      onPressResume: this.resume
    };
  },
  renderInfoPanel: function() {
    if (!this.state.playing || this.state.paused) {
      return Cosmos( {component:"InfoPanel"} );
    }
  },
  componentDidMount: function() {
    $(window).on('keydown', this.onKeyDown);
    $(window).on('keyup', this.onKeyUp);
  },
  componentWillUnmount: function() {
    $(window).off('keydown', this.onKeyDown);
    $(window).off('keyup', this.onKeyUp);
  },
  onKeyDown: function(e) {
    // Prevent page from scrolling when pressing arrow keys
    if (_.values(Flatris.KEYS).indexOf(e.keyCode) != -1) {
      e.preventDefault();
    }
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    switch (e.keyCode) {
    case Flatris.KEYS.DOWN:
      this.refs.well.setState({dropAcceleration: true});
      break;
    case Flatris.KEYS.UP:
      this.refs.well.rotateTetrimino();
      break;
    case Flatris.KEYS.LEFT:
      this.refs.well.moveTetriminoToLeft();
      break;
    case Flatris.KEYS.RIGHT:
      this.refs.well.moveTetriminoToRight();
    }
  },
  onKeyUp: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    if (e.keyCode == Flatris.KEYS.DOWN) {
      this.refs.well.setState({dropAcceleration: false});
    }
  },
  onRotatePress: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    e.preventDefault();
    this.refs.well.rotateTetrimino();
  },
  onLeftPress: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    e.preventDefault();
    this.refs.well.moveTetriminoToLeft();
  },
  onRightPress: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    e.preventDefault();
    this.refs.well.moveTetriminoToRight();
  },
  onPullPress: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    e.preventDefault();
    this.refs.well.setState({dropAcceleration: true});
  },
  onPullRelease: function(e) {
    // Ignore user events when game is stopped or paused
    if (!this.state.playing || this.state.paused) {
      return;
    }
    e.preventDefault();
    this.refs.well.setState({dropAcceleration: false});
  },
  onTetriminoLanding: function(drop) {
    // Stop inserting Tetriminos and awarding bonuses after game is over
    if (!this.state.playing) {
      return;
    }
    var score = this.state.score,
        lines = this.state.lines,
        level = Math.floor(lines / 10) + 1;

    // Rudimentary scoring logic, no T-Spin and combo bonuses. Read more at
    // http://tetris.wikia.com/wiki/Scoring
    score += drop.hardDrop ? drop.cells * 2 : drop.cells;
    if (drop.lines) {
      score += Flatris.LINE_CLEAR_BONUSES[drop.lines - 1] * level;
      lines += drop.lines;
    }

    // Increase speed with every ten lines cleared (aka level)
    if (Math.floor(lines / 10) + 1 > level &&
        this.refs.well.state.dropFrames > Flatris.DROP_FRAMES_ACCELERATED) {
      this.refs.well.increaseSpeed();
    }

    this.setState({
      score: score,
      lines: lines
    });
    this.insertNextTetriminoInWell(this.state.nextTetrimino);
  },
  onFullWell: function() {
    this.pause();
    this.setState({
      playing: false,
      // There won't be any next Tetrimino when the game is over
      nextTetrimino: null
    });
  },
  insertNextTetriminoInWell: function(nextTetrimino) {
    this.refs.well.loadTetrimino(nextTetrimino);
    this.setState({nextTetrimino: this.getRandomTetriminoType()});
  },
  getRandomTetriminoType: function() {
    return "I";
  }
});

/** @jsx React.DOM */

Cosmos.components.GamePanel = React.createClass({displayName: 'GamePanel',
  /**
   * The game panel contains
   * - the next Tetrimono to be inserted
   * - the score and lines cleared
   * - start or pause/resume controls
   */
  getDefaultProps: function() {
    return {
      playing: false,
      paused: false,
      score: 0,
      lines: 0,
      nextTetrimino: null
    };
  },
  render: function() {
    return (
      React.DOM.div( {className:"game-panel"}, 
        React.DOM.p( {className:"title"}, "Flatris"),
        React.DOM.p( {className:"label"}, "Score"),
        React.DOM.p( {className:"count"}, this.props.score),
        React.DOM.p( {className:"label"}, "Lines Cleared"),
        React.DOM.p( {className:"count"}, this.props.lines),
        React.DOM.p( {className:"label"}, "Next Shape"),
        React.DOM.div( {className:this.getNextTetriminoClass()}, 
          this.renderNextTetrimino()
        ),
        this.renderGameButton()
      )
    );
  },
  renderNextTetrimino: function() {
    var nextTetrimino = this.props.nextTetrimino;
    if (!nextTetrimino) {
      return;
    }
    return (
      Cosmos( {component:"Tetrimino",
              color:Flatris.COLORS[nextTetrimino],
              state:{
                 grid: Flatris.SHAPES[nextTetrimino]
              }} )
    );
  },
  renderGameButton: function() {
    var eventHandler,
        label;
    if (!this.props.playing) {
      eventHandler = this.props.onPressStart;
      label = 'New game';
    } else if (this.props.paused) {
      eventHandler = this.props.onPressResume;
      label = 'Resume';
    } else {
      eventHandler = this.props.onPressPause;
      label = 'Pause';
    }
    return React.DOM.button(Flatris.attachPointerDownEvent(eventHandler), label);
  },
  getNextTetriminoClass: function() {
    var classes = ['next-tetrimino'];
    // We use this extra class to position tetriminos differently from CSS
    // based on their type
    if (this.props.nextTetrimino) {
      classes.push('next-tetrimino-' + this.props.nextTetrimino);
    }
    return classes.join(' ');
  }
});

/** @jsx React.DOM */

Cosmos.components.InfoPanel = React.createClass({displayName: 'InfoPanel',
  /**
   * Information panel for the Flatris game/Cosmos demo, shown in between game
   * states.
   */
  render: function() {
    return (
      React.DOM.div( {className:"info-panel"}, 
        React.DOM.p( {className:"headline"}, React.DOM.em(null, "Flatris"), " is demo app for the ", React.DOM.a( {href:"https://github.com/skidding/cosmos"}, "Cosmos"), " JavaScript user interface framework, built using ", React.DOM.a( {href:"https://github.com/facebook/react"}, "React"), " components."),
        React.DOM.p(null, "Inspired by the classic ", React.DOM.a( {href:"http://en.wikipedia.org/wiki/Tetris"}, "Tetris"), " game, the game can be played both with a keyboard using the arrow keys, and on mobile devices using the buttons below."),
        React.DOM.p(null, "Because Cosmos can serialize the entire state of an application at any given time, Flatris stores your game state into the browser local storage when you close the tab and resumes playing whenever you return. Try a hard-refresh in the middle of a game."),
        React.DOM.p(null, "The project source has under 1k lines of JS code and is open source on ", React.DOM.a( {href:"https://github.com/skidding/flatris"}, "GitHub."))
      )
    );
  }
});

/** @jsx React.DOM */

Cosmos.components.SquareBlock = React.createClass({displayName: 'SquareBlock',
  /**
   * Building block for Tetriminos, occupying a 1x1 square block. The only
   * configurable property square blocks have is their color.
   */
  getDefaultProps: function() {
    return {
      color: Flatris.COLORS.L
    };
  },
  render: function() {
    return (
      React.DOM.div( {className:"square-block",
           style:{backgroundColor: this.props.color}})
    );
  }
});

/** @jsx React.DOM */

Cosmos.components.Tetrimino = React.createClass({displayName: 'Tetrimino',
  /**
   * A tetromino is a geometric shape composed of four squares, connected
   * orthogonally. Read more at http://en.wikipedia.org/wiki/Tetromino
   */
  mixins: [Cosmos.mixins.PersistState],
  getDefaultProps: function() {
    return {
      color: Flatris.COLORS.T
    };
  },
  getInitialState: function() {
    return {
      grid: Flatris.SHAPES.T
    };
  },
  rotate: function() {
    this.setState({grid: this.getRotatedGrid()});
  },
  getRotatedGrid: function() {
    // Function inspired by http://stackoverflow.com/a/2800033/128816
    var matrix = [],
        rows = this.state.grid.length,
        cols = this.state.grid[0].length,
        row,
        col;
    for (row = 0; row < rows; row++) {
      matrix[row] = [];
      for (col = 0; col < cols; col++) {
        matrix[row][col] = this.state.grid[cols-1-col][row];
      }
    }
    return matrix;
  },
  getNumberOfCells: function() {
    // TODO: Count actual cells (so far all Tetriminos have 4 cells)
    return 4;
  },
  render: function() {
    return (
      React.DOM.ul( {className:"tetrimino"}, 
        this.renderGridBlocks()
      )
    );
  },
  renderGridBlocks: function() {
    var blocks = [],
        rows = this.state.grid.length,
        cols = this.state.grid[0].length,
        row,
        col;
    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        if (this.state.grid[row][col]) {
          blocks.push(
            React.DOM.li( {className:"grid-square-block",
                key:row + '-' + col,
                style:{
                  top: (row * 25) + '%',
                  left: (col * 25) + '%'
                }}, 
              Cosmos( {component:"SquareBlock",
                      color:this.props.color} )
            )
          );
        }
      }
    }
    return blocks;
  }
});

/** @jsx React.DOM */

Cosmos.components.WellGrid = React.createClass({displayName: 'WellGrid',
  /**
   * Matrix for the landed Tetriminos inside the Flatris Well. Isolated from
   * the Well component because it needs to update it state as
   */
  mixins: [Cosmos.mixins.PersistState],
  getDefaultProps: function() {
    return {
      rows: Flatris.WELL_ROWS,
      cols: Flatris.WELL_COLS
    };
  },
  getInitialState: function() {
    return {
      grid: this.generateEmptyMatrix(),
      // Grid blocks need unique IDs to be used as React keys in order to tie
      // them to DOM nodes and prevent reusing them between rows when clearing
      // lines. DOM nodes need to stay the same to animate them when "falling"
      gridBlockCount: 0
    };
  },
  reset: function() {
    // This Component doesn't update after state changes by default, see
    // shouldComponentUpdate method
    this.setState({
      grid: this.generateEmptyMatrix()
    });
    this.forceUpdate();
  },
  transferTetriminoBlocksToGrid: function(tetrimino, tetriminoPositionInGrid) {
    var rows = tetrimino.state.grid.length,
        cols = tetrimino.state.grid[0].length,
        row,
        col,
        relativeRow,
        relativeCol,
        blockCount = this.state.gridBlockCount,
        lines;
    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        // Ignore blank squares from the Tetrimino grid
        if (!tetrimino.state.grid[row][col]) {
          continue;
        }
        relativeRow = tetriminoPositionInGrid.y + row;
        relativeCol = tetriminoPositionInGrid.x + col;
        // When the Well is full the Tetrimino will land before it enters the
        // top of the Well
        if (this.state.grid[relativeRow]) {
          this.state.grid[relativeRow][relativeCol] =
            ++blockCount + tetrimino.props.color;
        }
      }
    }
    // Clear lines created after landing and transfering a Tetrimino
    lines = this.clearLinesFromGrid(this.state.grid);
    // Push grid updates reactively and update DOM since we know for sure the
    // grid changed here
    this.setState({
      grid: this.state.grid,
      gridBlockCount: blockCount
    });
    this.forceUpdate();
    // Return lines cleared to measure success of Tetrimino landing :)
    return lines;
  },
  shouldComponentUpdate: function() {
    // Knowing that—even without DOM mutations—parsing all grid blocks is very
    // CPU expensive, we default to not calling the render() method when parent
    // Components update and only trigger render() manually when the grid
    // changes
    return false;
  },
  render: function() {
    return (
      React.DOM.ul( {className:"well-grid"}, 
        this.renderGridBlocks()
      )
    );
  },
  renderGridBlocks: function() {
    var blocks = [],
        widthPercent = 100 / this.props.cols,
        heightPercent = 100 / this.props.rows,
        row,
        col,
        blockValue;
    for (row = 0; row < this.props.rows; row++) {
      for (col = 0; col < this.props.cols; col++) {
        if (!this.state.grid[row][col]) {
          continue;
        }
        blockValue = this.state.grid[row][col];
        blocks.push(
          React.DOM.li( {className:"grid-square-block",
              key:this.getIdFromBlockValue(blockValue),
              style:{
                width: widthPercent + '%',
                height: heightPercent + '%',
                top: (row * heightPercent) + '%',
                left: (col * widthPercent) + '%'
              }}, 
            Cosmos( {component:"SquareBlock",
                    color:this.getColorFromBlockValue(blockValue)} )
          )
        );
      }
    }
    return blocks;
  },
  generateEmptyMatrix: function() {
    var matrix = [],
        row,
        col;
    for (row = 0; row < this.props.rows; row++) {
      matrix[row] = [];
      for (col = 0; col < this.props.cols; col++) {
        matrix[row][col] = null;
      }
    }
    return matrix;
  },
  clearLinesFromGrid: function(grid) {
    /**
     * Clear all rows that form a complete line, from one left to right, inside
     * the Well grid. Gravity is applied to fill in the cleared lines with the
     * ones above, thus freeing up the Well for more Tetriminos to enter.
     */
    var linesCleared = 0,
        isLine,
        row,
        col;
    for (row = this.props.rows - 1; row >= 0; row--) {
      isLine = true;
      for (col = this.props.cols - 1; col >= 0; col--) {
        if (!grid[row][col]) {
          isLine = false;
        }
      }
      if (isLine) {
        this.removeGridRow(row);
        linesCleared++;
        // Go once more through the same row
        row++;
      }
    }
    return linesCleared;
  },
  removeGridRow: function(rowToRemove) {
    /**
     * Remove a row from the Well grid by descending all rows above, thus
     * overriding it with the previous row.
     */
    var row,
        col;
    for (row = rowToRemove; row >= 0; row--) {
      for (col = this.props.cols - 1; col >= 0; col--) {
        this.state.grid[row][col] = row ? this.state.grid[row - 1][col] : null;
      }
    }
  },
  getIdFromBlockValue: function(blockValue) {
    return blockValue.split('#')[0];
  },
  getColorFromBlockValue: function(blockValue) {
    return '#' + blockValue.split('#')[1];
  }
});

/** @jsx React.DOM */

Cosmos.components.Well = React.createClass({displayName: 'Well',
  /**
   * A rectangular vertical shaft, where Tetriminos fall into during a Flatris
   * game. The Well has configurable size, speed. Tetrimino pieces can be
   * inserted inside the well and they will fall until they hit the bottom,
   * continuously filling it. Whenever the pieces form a straight horizontal
   * line it will be cleared, emptying up space and allowing more pieces to
   * enter afterwards.
   */
  mixins: [Cosmos.mixins.PersistState,
           Cosmos.mixins.AnimationLoop],
  getDefaultProps: function() {
    return {
      rows: Flatris.WELL_ROWS,
      cols: Flatris.WELL_COLS
    };
  },
  getInitialState: function() {
    return {
      activeTetrimino: null,
      // The active Tetrimino position will be reset whenever a new Tetrimino
      // is inserted in the Well, using the getInitialPositionForTetriminoType
      // method
      activeTetriminoPosition: {x: 0, y: 0},
      dropFrames: Flatris.DROP_FRAMES_DEFAULT,
      dropAcceleration: null
    };
  },
  children: {
    wellGrid: function() {
      return {
        component: 'WellGrid'
      };
    },
    activeTetrimino: function() {
      if (!this.state.activeTetrimino) {
        return;
      }
      return {
        component: 'Tetrimino',
        color: Flatris.COLORS[this.state.activeTetrimino]
      };
    }
  },
  reset: function() {
    this.setState({
      dropFrames: Flatris.DROP_FRAMES_DEFAULT
    });
    this.refs.wellGrid.reset();
    this.loadTetrimino(null);
  },
  loadTetrimino: function(type) {
    this.setState({
      activeTetrimino: type,
      // Reset position to place new Tetrimino at the top entrance point
      activeTetriminoPosition: this.getInitialPositionForTetriminoType(type)
    });
  },
  rotateTetrimino: function() {
    if (this.state.activeTetrimino) {
      var tetriminoGrid = this.refs.activeTetrimino.getRotatedGrid(),
          // If the rotation causes the active Tetrimino to go outside of the
          // Well bounds, its position will be adjusted to fit inside
          tetriminoPosition = this.fitTetriminoGridPositionInWellBounds(
            tetriminoGrid, this.state.activeTetriminoPosition);
      // If the rotation causes a collision with landed Tetriminos than it won't
      // be applied
      if (this.isPositionAvailableForTetriminoGrid(tetriminoGrid,
                                                   tetriminoPosition)) {
        this.refs.activeTetrimino.setState({grid: tetriminoGrid});
      }
    }
  },
  moveTetriminoToLeft: function() {
    this.moveTetrimino(-1);
  },
  moveTetriminoToRight: function() {
    this.moveTetrimino(1);
  },
  moveTetrimino: function(offset) {
    if (!this.state.activeTetrimino) {
      return;
    }
    var tetriminoGrid = this.refs.activeTetrimino.state.grid,
        tetriminoPosition = _.clone(this.state.activeTetriminoPosition);
    tetriminoPosition.x += offset;
    // Attempting to move the Tetrimino outside the Well bounds or over landed
    // Tetriminos will be ignored
    if (this.isPositionAvailableForTetriminoGrid(tetriminoGrid,
                                                 tetriminoPosition)) {
      this.setState({activeTetriminoPosition: tetriminoPosition});
    }
  },
  increaseSpeed: function() {
    this.setState({dropFrames: this.state.dropFrames -
                               Flatris.DROP_FRAMES_DECREMENT});
  },
  onFrame: function(frames) {
    if (!this.state.activeTetrimino) {
      return;
    }
    var tetriminoGrid = this.refs.activeTetrimino.state.grid,
        tetriminoPosition = _.clone(this.state.activeTetriminoPosition),
        drop = {
          cells: this.refs.activeTetrimino.getNumberOfCells(),
          hardDrop: this.state.dropAcceleration
        };
    tetriminoPosition.y += this.getDropStepForFrames(frames);
    // The active Tetrimino keeps falling down until it hits something
    if (this.isPositionAvailableForTetriminoGrid(tetriminoGrid,
                                                 tetriminoPosition)) {
      this.setState({activeTetriminoPosition: tetriminoPosition});
    } else {
      // A big frame skip could cause the Tetrimino to jump more than one row.
      // We need to ensure it ends up in the bottom-most one in case the jump
      // caused the Tetrimino to land
      tetriminoPosition =
        this.getBottomMostPositionForTetriminoGrid(tetriminoGrid,
                                                   tetriminoPosition);
      this.setState({activeTetriminoPosition: tetriminoPosition});
      // This is when the active Tetrimino hits the bottom of the Well and can
      // no longer be controlled
      drop.lines = this.refs.wellGrid.transferTetriminoBlocksToGrid(
        this.refs.activeTetrimino,
        this.getGridPosition(this.state.activeTetriminoPosition)
      );
      // Unload Tetrimino after landing it
      this.loadTetrimino(null);
      // Notify any listening parent when Well is full, it should stop
      // inserting any new Tetriminos from this point on (until the Well is
      // reset at least)
      if (tetriminoPosition.y < 0 &&
          typeof(this.props.onFullWell) == 'function') {
        this.props.onFullWell();
      }
      // Notify any listening parent about Tetrimino drops, with regard to the
      // one or more possible resulting line clears
      if (typeof(this.props.onTetriminoLanding) == 'function') {
        this.props.onTetriminoLanding(drop);
      }
    }
  },
  componentDidUpdate: function(prevProps, prevState) {
    // Populate grid of active Tetrimino only after a new one has been set
    if (this.state.activeTetrimino &&
        this.state.activeTetrimino != prevState.activeTetrimino) {
      // Child state should only be touched imperatively, it is managed
      // internally inside Tetrimino Component afterwards
      this.refs.activeTetrimino.setState({
        grid: Flatris.SHAPES[this.state.activeTetrimino]
      });
    }
  },
  render: function() {
    return (
      React.DOM.div( {className:"well"}, 
        React.DOM.div( {className:"active-tetrimino",
             style:_.extend(this.getTetriminoCSSSize(),
                             this.getActiveTetriminoCSSPosition())}, 
          this.loadChild('activeTetrimino')
        ),
        this.loadChild('wellGrid')
      )
    );
  },
  getTetriminoCSSSize: function() {
    return {
      width: 100 / this.props.cols * 4 + '%',
      height: 100 / this.props.rows * 4 + '%'
    };
  },
  getActiveTetriminoCSSPosition: function() {
    var position =
      this.getGridPosition(this.state.activeTetriminoPosition);
    return {
      top: 100 / this.props.rows * position.y + '%',
      left: 100 / this.props.cols * position.x + '%'
    }
  },
  getGridPosition: function(floatingPosition) {
    // The position has floating numbers because of how gravity is incremented
    // with each frame
    return {
      x: Math.floor(floatingPosition.x),
      y: Math.floor(floatingPosition.y)
    };
  },
  getInitialPositionForTetriminoType: function(type) {
    /**
     * Generates positions a Tetrimino entering the Well. The I Tetrimino
     * occupies columns 4, 5, 6 and 7, the O Tetrimino occupies columns 5 and
     * 6, and the remaining 5 Tetriminos occupy columns 4, 5 and 6. Pieces
     * spawn above the visible playfield (that's why y is -2)
     */
    if (!type) {
      return {x: 0, y: 0};
    }
    var grid = Flatris.SHAPES[type];
    return {
      x: Math.round(this.props.cols / 2) - Math.round(grid[0].length / 2),
      y: -2
    };
  },
  getDropStepForFrames: function(frames) {
    var dropFrames = this.state.dropAcceleration ?
                     Flatris.DROP_FRAMES_ACCELERATED : this.state.dropFrames;
    return frames / dropFrames;
  },
  isPositionAvailableForTetriminoGrid: function(tetriminoGrid, position) {
    var tetriminoPositionInGrid = this.getGridPosition(position),
        tetriminoRows = tetriminoGrid.length,
        tetriminoCols = tetriminoGrid[0].length,
        row,
        col,
        relativeRow,
        relativeCol;
    for (row = 0; row < tetriminoRows; row++) {
      for (col = 0; col < tetriminoCols; col++) {
        // Ignore blank squares from the Tetrimino grid
        if (!tetriminoGrid[row][col]) {
          continue;
        }
        relativeRow = tetriminoPositionInGrid.y + row;
        relativeCol = tetriminoPositionInGrid.x + col;
        // Ensure Tetrimino block is within the horizontal bounds
        if (relativeCol < 0 || relativeCol >= this.props.cols) {
          return false;
        }
        // Tetriminos are accepted on top of the Well (it's how they enter)
        if (relativeRow < 0) {
          continue;
        }
        // Check check if Tetrimino hit the bottom of the Well
        if (relativeRow >= this.props.rows) {
          return false;
        }
        // Then if the position is not already taken inside the grid
        if (this.refs.wellGrid.state.grid[relativeRow][relativeCol]) {
          return false;
        }
      }
    }
    return true;
  },
  fitTetriminoGridPositionInWellBounds: function(tetriminoGrid, position) {
    var tetriminoRows = tetriminoGrid.length,
        tetriminoCols = tetriminoGrid[0].length,
        row,
        col,
        relativeRow,
        relativeCol;
    for (row = 0; row < tetriminoRows; row++) {
      for (col = 0; col < tetriminoCols; col++) {
        // Ignore blank squares from the Tetrimino grid
        if (!tetriminoGrid[row][col]) {
          continue;
        }
        relativeRow = position.y + row;
        relativeCol = position.x + col;
        // Wall kick: A Tetrimino grid that steps outside of the Well grid will
        // be shifted slightly to slide back inside the Well grid
        if (relativeCol < 0) {
          position.x -= relativeCol;
        } else if (relativeCol >= this.props.cols) {
          position.x -= relativeCol-this.props.cols+1;
        }
      }
    }
    return position;
  },
  getBottomMostPositionForTetriminoGrid: function(tetriminoGrid, position) {
    // Snap vertical position to grid
    position.y = Math.floor(position.y);
    while (!this.isPositionAvailableForTetriminoGrid(tetriminoGrid, position)) {
      position.y -= 1;
    }
    return position;
  }
});
