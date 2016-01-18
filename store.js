import Utils from './utils';
var EventEmitter = require('events').EventEmitter;
var QuidStore = new EventEmitter();
var CHANGE_EVENT = 'change';
var currentState = {
  board: {
    rows: 6,
    columns: 6,
    grid: []
  },
  tokensArray: ['a', 'a', 'b', 'c'],
  stagedToken: 'a',
  movesRemaining: 730,
  score: 0,
  bankBalance:  0,
  gamePhase: 1,
  nextGoal: 125000,
  message: '',
  electedOffice: ''
};

QuidStore.setupBoard = function () {
  var rows = currentState.board.rows,
    columns = currentState.board.columns,
    startingTokens = ['a', 'a', 'a', 'a', 'a', 'b', 'b', 'c', 'a', 'a', 'b'],
    token;

    for (var i=0; i < rows; i++) {
      var row = [];
      for (var j=0; j < columns; j++) {
        row.push('');
      }
      currentState.board.grid.push(row);
    }

    // go though starting tokens and put the values on the board
    for (var i=0; i < startingTokens.length; i++) {
      var x = Math.floor(Math.random() * 5),
        y = Math.floor(Math.random() * 5);
        currentState.board.grid[x][y] = startingTokens[i];
    }

    //eliminate pre-matched tokens
    for (var i=0; i < rows; i++){
      for (var j = 0; j < columns; j++){
        token = currentState.board.grid[i][j];
        if (token !== '' && this.cardinalCheck(token, i, j).length >= 2){
          currentState.board.grid[i][j] = '';
        }
      }
    }
};

QuidStore.emitChange = function() {
  this.emit(CHANGE_EVENT);
};

QuidStore.addChangeListener = function(callback) {
  this.on(CHANGE_EVENT, callback);
};

QuidStore.removeChangeListener = function(callback) {
  this.removeListener(CHANGE_EVENT, callback);
};

QuidStore.getCurrentState = function(){
  return currentState;
};

QuidStore.checkEmpty = function(rowPos, colPos){
  return currentState.board.grid[rowPos][colPos] === '';
};

QuidStore.completeMove = function(rowPos, colPos){
  var playedToken = currentState.stagedToken;

  playedToken = this.handleMatches(playedToken, rowPos, colPos);
  currentState.board.grid[rowPos][colPos] = playedToken;
  currentState.movesRemaining--;
  if (currentState.movesRemaining === 0){
    this.handleElection();
  }

  if (this.isGameOver()){
    this.endGame('board');
  } else {
    this.setNextToken();
  }
  this.emitChange();
};

QuidStore.setNextToken = function(){
  var tokens = currentState.tokensArray;
  currentState.stagedToken = tokens[Math.floor(Math.random() * tokens.length)];
};

QuidStore.handleMatches = function(token, rowPos, colPos, isRecursive){
  var matchCoords = this.cardinalCheck(token, rowPos, colPos),
    moreCoords = [],
    toAddCoords = [],
    newToken;

  if (matchCoords.length > 0){
    for (var i = 0; i < matchCoords.length; i++){
      moreCoords = this.cardinalCheck(token, matchCoords[i][0], matchCoords[i][1]);
      if (moreCoords.length > 0){
        toAddCoords = toAddCoords.concat(moreCoords);
      }
    }
  }
  if (toAddCoords.length > 0){
    matchCoords = matchCoords.concat(toAddCoords);
  }

  this.handleScoreboard(matchCoords.length, token, isRecursive);

  if (matchCoords.length >= 2){
    newToken = Utils.promoteToken(token);
    if (newToken !== 'final') {
      this.clearMatches(matchCoords);
      newToken = this.handleMatches(newToken, rowPos, colPos, true);
      return newToken;
    } else {
      return token;
    }
  } else {
    return token;
  }
};

QuidStore.cardinalCheck = function(token, rowPos, colPos){
  var possibleMatches = [ [rowPos, colPos+1], [rowPos, colPos-1], [rowPos+1, colPos], [rowPos-1, colPos]],
    board = currentState.board,
    matchCoords = [],
    checkRow,
    checkCol,
    squareToken,
    i;

  for (i = 0; i < possibleMatches.length; i++){
    checkRow = possibleMatches[i][0];
    checkCol = possibleMatches[i][1];

    if (checkRow >= 0 && checkRow < board.rows && checkCol >= 0 && checkCol < board.columns ) {
      if (currentState.board.grid[checkRow][checkCol] === token) {
        matchCoords.push([checkRow, checkCol]);
      }
    }
  }
  return matchCoords;
};

QuidStore.clearMatches = function(matches){
  for (var i = 0; i < matches.length; i++){
    currentState.board.grid[matches[i][0]][matches[i][1]] = '';
  }
};

QuidStore.handleScoreboard = function(count, token, isRecursive) {
  var points = 0,
    money = 0;
  if (count < 2 && isRecursive !== true) {
    points = Utils.scoreToken(token);
    money = Utils.earnFromToken(token);
  } else if (count >= 2){
    points = Utils.scoreMatch(count, token);
    money = Utils.earnFromMatch(count, token);
    if (isRecursive){
      points = Math.round(points * 1.3);
      money = Math.round(money * 1.25);
    }
  }
  currentState.score = currentState.score + points;
  currentState.bankBalance = currentState.bankBalance + money;
};

QuidStore.handleElection = function(){
  currentState.bankBalance = currentState.bankBalance - currentState.nextGoal;
  if (currentState.bankBalance < 0){
    this.endGame('election');
  } else {
    currentState.phase++;
    this.changePhase(currentState.phase);
    //TODO: final tokens-->lobbyist bench conversion???
  }
};

//TODO: all of these Utils maps need to be filled out for whole game
QuidStore.changePhase = function(phase){
  //change every election
  currentState.movesRemaining = Utils.resetMovesCounter(phase);
  currentState.nextGoal = Utils.setNextGoal(phase);

  //change more often
  // currentState.tokensArray = Utils.changePossibleTokens(phase, currentState.movesRemaining);
  currentState.message = Utils.changeMessage(phase, currentState.movesRemaining);
  //changes less often
  currentState.electedOffice = Utils.setElectedOffice(phase);
};

QuidStore.isGameOver = function(){
  var board = currentState.board,
    gameOver = true;

  for (var i=0; i < board.rows; i++) {
    for (var j = 0; j < board.columns; j++){
      if (board.grid[i][j] === ''){
        gameOver = false;
        return gameOver;
      }
    }
  }
  return gameOver;
};

//TODO: Button to restart game needs to replace stagedToken?
QuidStore.endGame = function(failType){
  var reason = 'Game Over.';
  if (failType === 'board'){
    reason = reason + ' Talk about gridlock!'
  } else if (failType === 'election'){
    reason = reason + ' People can be bought, just not always by you.'
  }
  currentState.stagedToken = '';
  currentState.message = reason;
};

export default QuidStore;
