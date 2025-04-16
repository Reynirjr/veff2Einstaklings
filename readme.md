# Tónaleikarnir!

## 📑 Efnisyfirlit
• Um verkefnið  
• Eiginleikar  
• Útfærsla og skilyrði  
• Tækni  
• Uppsetning fyrir þróun  
• Gagnamódel  
• Verkplan og matskvarði  
• Hönnunarferli og áskoranir  
• Væntanlegar viðbætur  
• Höfundur  

## Um verkefnið og inngangur
Tónleikarnir er vefsíða þar sem notendur geta stofnað hópa, deilt tónlist og kosið um bestu lögin. Hver hópur hefur sínar tónlistarumferðir þar sem meðlimir deila lögum tengdum ákveðnu þema, síðan kjósa um uppáhaldslögin sín. Vinningshafi hverrar umferðar fær að velja þema fyrir næstu umferð. Kerfið heldur utan um stigatöflu yfir sigra og býður upp á persónulega notendaprófíla.

Uppruni hugmyndar
Ég fékk þessa hugmynd frá leik sem við spilum í vinnunni, þar sem hver og einn setur fram YouTube-lag sem hann telur passa við ákveðið þema, og svo kjósum við um uppáhalds lagið okkar sem okkur finnst best passa við þemað. Þetta var skemmtileg leið til að deila tónlist og kynnast tónlistarsmekk hvers annars, en ferlið var flókið að framkvæma handvirkt. Mig langaði að gera þetta ferli sjálfvirkara og skemmtilegra með kerfi sem stýrir tímasetningum, kosningum og stigagjöf.

## Eiginleikar
Notendaumsjón: Skráning, innskráning, prófílmyndir
Hópastofnun: Búa til hópa með stillanlegu kosningakerfi
Tónlistarumferðir: Innsendingafasi, kosningafasi og úrslitafasi
Stigatafla: Heldur utan um sigra notenda
Þemakerfi: Sigurvegari velur þema næstu umferðar
Niðurtalning: Sjálfvirkt kerfi fyrir upphaf nýrra fasa 

## Útfærsla og skilyrði
Bakendi í Node.js og Express. Gagnagrunnur með PostgreSQL og Sequelize. Full notendaumsjón með JWT token og bcrypt. Framendinn keyrir á EJS, CSS og JavaScript.

## Tækni
• Node.js, Express, PostgreSQL, Sequelize  
• JWT, bcrypt  
• EJS, CSS, JavaScript, Cloudinary  
• Hýsing: Railway með CI/CD

## Uppsetning fyrir þróun
Klónaðu verkefnið: git clone https://github.com/Reynirjr/veff2Einstaklings
Settu upp pakka: npm install
Settu upp .env skrá með nauðsynlegum stillingum:
# Local development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tonleikarnir
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

## Gagnamódel
User	Notendaupplýsingar og prófílar
Group	Tónlistarhópar með stillingum
Round	Tónlistarumferðir með tímasetningu
Song	Lög sem notendur deila
Vote	Atkvæði notenda
UserScore	Stigagjöf og vinningshald notenda 

## Verkplan og matskvarði
• Vika 6–7: Gagnagrunnur  
• Vika 8–9: Bakendi  
• Vika 10–11: Framendi  
• Vika 12: Prófanir  
• Vika 13: Skýrsla og hýsing  
35% Bakendi og notendaumsjón: Innskráning, útskráning, hópastjórnun og atkvæði
20% Vefþjónusta: Skýr og vel skilgreind REST API fyrir alla virkni
35% Framendi: Þægilegt notendaviðmót sem sýnir YouTube myndskeið, tekur við gögnum og auðveldar kosningu
10% Skýrsla og hönnunarskjöl: Skýrsla um framgang verkefnis og grunnteikningar

## Hönnunarferli og áskoranir
### Hvað gekk vel
Gagnagrunnshönnun: Tengingarnar á milli taflna og módel voru vel skipulögð frá byrjun
Notendaumsjón: JWT auðkenning með refresh tokens var auðveld í útfærslu
Sjálfvirkt umferðakerfi: Kerfið sem sér um að breyta umferðum milli fasa gekk mjög vel
### Hvað gekk illa
Sigurvegarar og Kosninga aðferðir: eins og er er einungis einföld kosning sem virkar og átti ég í miklum erfiðleikum að fá sigurvegara windowin til að poppa upp.
Cloudinary samþætting: Það tók tíma að fá prófílmyndirnar til að virka rétt í production
Content Security Policy: CSP stillingar voru flóknar að leysa í samhengi við YouTube embed og Cloudinary

### hvað var áhugavert
Mér þótti Scheduling frekar skemmtilegt og einnig mjög gaman að bæta við prófílmyndum.

## Væntanlegar viðbætur
Klára möguleikana að hinum kosningunum,
Gera útlitið flottara og skemmtilegara, 
bæta við hljóðum og tónlist á síðuna til að gera hana "tónlistarlegri"


## Höfundur
Gert af mér Benjamín Reyni Jóhannssyni
