- Launch the project:

local :

front :
    cd front
    npm install
    nmp run dev
    
back :
    cd back
    source venv/bin/activate
    cd .. && ./start_pdf_server.sh

backnode :
    cd backNode
    npm install
    npm run db:sync
    npm run dev
