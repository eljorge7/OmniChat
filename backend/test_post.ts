import axios from 'axios';
axios.post('http://localhost:3002/api/inbox/bot/config', {
    companyId: 'bcd85cb5-e830-4d86-b24c-c6c7d43fbed4', // Grupo Hurtado
    openAiKey: 'sk-proj-test123',
    openAiPrompt: 'test prompt'
}).then(console.log).catch(e => console.error(e.response ? e.response.data : e.message));
