/** @jsx React.DOM */

Cosmos.components.Well = React.createClass({
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
      <div className="well">
        <div className="active-tetrimino"
             style={_.extend(this.getTetriminoCSSSize(),
                             this.getActiveTetriminoCSSPosition())}>
          {this.loadChild('activeTetrimino')}
        </div>
        {this.loadChild('wellGrid')}
      </div>
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
