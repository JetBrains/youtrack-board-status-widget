import {
  countBoardProgress,
  getColumnSearchUrl,
  areSprintsEnabled
} from './agile-board-model';

describe('agile-board-model', () => {
  it('should define countBoardProgress', () => {
    (countBoardProgress({}).length).should.equal(0);
  });

  it('should define getColumnSearchUrl', () => {
    const agileBoard = {name: 'Test'};

    (getColumnSearchUrl(agileBoard, {}, {})).should.equal(
      'has%3A%20%7BBoard%20Test%7D%20'
    );
  });

  it('should define areSprintsEnabled', () => {
    (areSprintsEnabled({})).should.equal(false);
  });
});
