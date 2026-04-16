const { OpenAI } = require('openai');
require('dotenv').config();
async function test() {
   const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
   try {
       const response = await openai.chat.completions.create({
           model: "gpt-4o-mini",
           messages: [
               {
                   role: "user",
                   content: [
                       { type: "text", text: "[El cliente ha enviado una imagen o archivo adjunto: image/jpeg]" },
                       { type: "image_url", image_url: { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/512px-React-icon.svg.png" } }
                   ]
               }
           ]
       });
       console.log(response.choices[0].message.content);
   } catch (e) {
       console.error("ERROR:", e.message);
   }
}
test();
