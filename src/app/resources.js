const SERVICE_FIELDS = 'id,name,applicationName,homeUrl';

const BOARD_FIELDS = 'id,name,sprints(id,name),sprintsSettings(disableSprints,explicitQuery),columnSettings(field(id,name))';
const SPRINT_CELL_FIELDS = 'id,column(id),issues(id)';
const SPRINT_ROW_FIELDS = `id,cells(${SPRINT_CELL_FIELDS})`;
const SPRINT_COLUMN_FIELDS = 'id,agileColumn(fieldValues(name,presentation))';
const SPRINT_FIELDS = `id,name,columns(${SPRINT_COLUMN_FIELDS}),swimlanes(${SPRINT_ROW_FIELDS}),orphanRow(${SPRINT_ROW_FIELDS})`;

export async function loadBoards(fetchYouTrack) {
  return await fetchYouTrack(`api/agiles?fields=${BOARD_FIELDS}`);
}

export async function loadSprint(fetchYouTrack, boardId, sprintId) {
  return await fetchYouTrack(`api/agiles/${boardId}/sprints/${sprintId}/board?fields=${SPRINT_FIELDS}`);
}

export async function getYouTrackService(fetchHub) {
  const data = await fetchHub(`api/rest/services?fields=${SERVICE_FIELDS}`);
  return (data.services || []).filter(
    service => service.applicationName === 'YouTrack'
  )[0];
}
