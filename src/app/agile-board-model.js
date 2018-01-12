export const MAX_PROGRESS_BAR_HEIGHT = 160;
const PROGRESS_BAR_TOP_MARGIN = 2;

function getIssuesAmountPerColumn(sprint, columnId) {
  const concatArrays = (array1, array2) => array1.concat(array2);
  const rows = concatArrays(
    sprint.swimlanes || [], sprint.orphanRow || []
  );

  return rows.
    map(row => row.cells || []).
    reduce(concatArrays, []).
    filter(cell => cell.column.id === columnId).
    map(cell => cell.issues).
    reduce(concatArrays, []).length;
}

function getColumnPresentation(agileColumn) {
  return (agileColumn.fieldValues || []).
    map(value => value.presentation || value.name).
    join(', ');
}

function createColumnIssuesQuery(agileBoard, column) {
  const field = agileBoard.columnSettings && agileBoard.columnSettings.field;
  const fieldValues = column.agileColumn && column.agileColumn.fieldValues;
  if (!field || !fieldValues || !fieldValues.length) {
    return '';
  }
  const values = (fieldValues || []).map(fieldValue => `{${fieldValue.name}}`).join(', ');
  return `${field.name}: ${values}`;
}

export function getColumnSearchUrl(agileBoard, sprint, column) {
  const sprintIssuesQuery = areSprintsEnabled(agileBoard)
    ? `Board ${agileBoard.name}: {${sprint.name}}`
    : `has: {Board ${agileBoard.name}}`;
  const columnIssuesQuery = createColumnIssuesQuery(agileBoard, column);
  const explicitQuery = (agileBoard.sprintsSettings || {}).explicitQuery;
  const explicitQuerySuffix = explicitQuery ? `and (${explicitQuery})` : '';

  return encodeURIComponent(
    `${sprintIssuesQuery} ${columnIssuesQuery} ${explicitQuerySuffix}`
  );
}

export function countBoardProgress(boardData) {
  let max = 0;

  const progress = (boardData.columns || []).
    filter(column => column.agileColumn).
    map(column => {
      let amount = getIssuesAmountPerColumn(boardData, column.id);
      const progressBar = {
        columnId: column.id,
        columnName: getColumnPresentation(column.agileColumn),
        amount
      };
      const wipLimit = column.agileColumn.wipLimit;
      if (wipLimit) {
        progressBar.maxLimit = wipLimit.max;
        if (progressBar.maxLimit && amount > progressBar.maxLimit) {
          amount = progressBar.maxLimit;
        }
        progressBar.minLimit = wipLimit.min;
      }
      if (amount > max) {
        max = amount;
      }
      return progressBar;
    });

  return progress.map(bar => {
    const title = bar.amount === 1
      ? `${bar.amount} card in state ${bar.columnName}`
      : `${bar.amount} cards in state ${bar.columnName}`;
    let height = Math.ceil(
      (bar.amount * MAX_PROGRESS_BAR_HEIGHT) / (max || MAX_PROGRESS_BAR_HEIGHT)
    );
    height = Math.min(
      height, MAX_PROGRESS_BAR_HEIGHT + PROGRESS_BAR_TOP_MARGIN
    );
    const underdue = (bar.minLimit !== 0) &&
      bar.minLimit && bar.amount < bar.minLimit;
    const overdue = bar.maxLimit && bar.amount > bar.maxLimit;

    return {
      height,
      underdue,
      title,
      overdue,
      columnId: bar.columnId,
      columnName: bar.columnName
    };
  });
}

export function areSprintsEnabled(board) {
  const sprintsSettings = board && board.sprintsSettings;
  return sprintsSettings ? !sprintsSettings.disableSprints : false;
}
