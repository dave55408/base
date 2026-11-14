/* Keep the supplied picture usable when index.html is opened directly. */
const fs=require('node:fs'),path=require('node:path');
const source=path.join(__dirname,'assets/reference/bridge-room.png'),target=path.join(__dirname,'assets/reference/bridge-room-image.js');
fs.writeFileSync(target,'/* Exact bridge-room picture, embedded for local-file texture access. */\nwindow.BRIDGE_ROOM_IMAGE='+JSON.stringify('data:image/png;base64,'+fs.readFileSync(source).toString('base64'))+';\n');
