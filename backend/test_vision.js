const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
async function test() {
   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
   const filepath = "c:/Users/jorge/Documents/Antigravity/OmniChat/backend/dist/uploads/media_1776126449828_bc05996c.jpeg";
   const base64Img = fs.readFileSync(filepath, { encoding: 'base64' });
   try {
       const response = await openai.chat.completions.create({
           model: "gpt-4o-mini",
           messages: [
               {
                   role: "user",
                   content: [
                       { type: "text", text: "¿Qué ves en esta imagen?" },
                       { type: "image_url", image_url: { url: \data:image/jpeg;base64,\\ } }
                   ]
               }
           ]
       });
       console.log(response.choices[0].message.content);
   } catch (e) {
       console.error("ERROR OPENAI:", e.message);
   }
}
test();
