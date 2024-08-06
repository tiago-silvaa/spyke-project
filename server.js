const express = require('express');
const app = express();
const db = require('./db');
const session = require('express-session');
const path = require('path');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'spyke',
    resave: false,
    saveUninitialized: true
}));

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/google/callback'
);

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        res.locals.usernameDisplay = req.session.user.username;
        return next();
    } else {
        res.redirect('/login');
    }
}

function isGoogleAuthenticated(req, res, next) {
    if (req.session.tokens) {
        oauth2Client.setCredentials(req.session.tokens);
        if (req.session.refresh_token) {
            oauth2Client.credentials.refresh_token = req.session.refresh_token;
        }
        return next();
    } else {
        res.redirect('/auth/google');
    }
}

app.get('/isGoogleAuthenticated', (req, res) => {
    if (req.session.tokens) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

//-------=---------------===--------------=-----------Endpoints-----------=---------===------------------=----------------

//------------------Autenticação com google--------------

const SCOPES = ['https://www.googleapis.com/auth/contacts'];

//Enviar utilizador para pedido de autenticação com Google
app.get('/auth/google', isAuthenticated, async(req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES
    });
    res.redirect(authUrl);
});

//Obter código de autorização, autorizar e atribuir token à sessão
app.get('/google/callback', isAuthenticated, async(req, res) => {

    const { code } = req.query; 
    const { tokens } = await oauth2Client.getToken(code);

    //Armazenar refresh token do google na sessão do utilizador
    if (tokens.refresh_token) {
        req.session.refresh_token = tokens.refresh_token;
    } 

    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.redirect('/spyke');
});


//-----------------------------Login, Registo, Logout--------------------

//-------Home Page para login e registo------
app.get('/', async(req, res) => {
    res.render('home');
});

//--------Renderizar página Registo---------
app.get('/register', async(req, res) => {
    res.render('register');
});

//----------Endpoint para efetuar registo--------
app.post('/auth/register', async(req, res) => {

    const { username, email, password } = req.body
    try {
        await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
        req.session.message = { type: 'success', content: 'Registration successful, please login.' };
        res.json(req.session.message);
    }
    catch (err) {
        console.log(err);
        req.session.message = { type: 'danger', content: 'Invalid credentials, please try again.' };
        res.json(req.session.message);
    }
});

//------------Renderizar página de login----------
app.get('/login', async(req, res) => {
    res.render('login');
});

//----------Endpoint para fazer login na app------
app.post('/auth/login', async(req, res) => {

    const { username, password } = req.body;

    const [userData] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

    if (userData.length === 0 || userData[0].password !== password) {
        req.session.message = { type: 'danger', content: 'Invalid username / password' };
        res.json(req.session.message);
    } else {
        req.session.message = { type: 'success', content: 'You can now access your Spyke!' };
        req.session.user = { id: userData[0].id, username };
        res.json(req.session.message);
    }
});

//---------Logout-------------
app.post('/auth/logout', async(req, res) => {
    req.session.destroy();
    res.json({ message: 'User logged out!'});
});


//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

//               Endpoints de contactos

//  1   -   Endpoint para renderizar página de contactos

app.get('/spyke', isAuthenticated, async(req, res) => {
    const googleAuthenticated = req.session.tokens !== undefined;
    try {
        const userId = req.session.user.id;
        const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
        res.render('index', { contacts, googleAuthenticated }); // ----> Renderizar página dos contactos com a lista de contactos
    } catch (error) {
        console.error('Erro ao buscar contatos:', error);
        res.status(500).send('Erro ao buscar contatos.');
    }
});

//  2   -   Fetch dos contactos da base de dados em json

app.get('/contactsData', isAuthenticated, async(req, res) => {
    try {
        const userId = req.session.user.id;
        const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
        res.json(contacts) // ----->  Passar dados json dos contactos para o frontend
    } catch (error) {
        console.error('Erro ao buscar contatos:', error);
        res.status(500).send('Erro ao buscar contatos.');
    }
});

//  3   -   Fetch contactos do google em formato json

app.get('/googleContactsData', isAuthenticated, isGoogleAuthenticated, async(req, res) => {

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    const response = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies'
    });
    const contacts = response.data.connections;
    res.json(contacts);
});

//  4   -   Importar os contactos do google e meter na app

app.get('/importGoogleContacts', isAuthenticated, isGoogleAuthenticated, async(req, res) => {

    const userId = req.session.user.id;

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    const response = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies'
    });
    const googleContacts = response.data.connections;

    for (let contact of googleContacts) {
        const { names, phoneNumbers, emailAddresses, organizations, addresses, urls, birthdays, biographies } = contact;
        const name = names ? names[0].givenName : '';
        const email = emailAddresses ? emailAddresses[0].value : '';
        const phone = phoneNumbers ? phoneNumbers[0].value : '';
        const jobTitle = organizations && organizations[0].title  ? organizations[0].title : '';
        const company = organizations && organizations[0].name ? organizations[0].name : '';
        const address = addresses ? addresses[0].formattedValue : '';
        const website = urls ? urls[0].value : '';
        const birthday = birthdays && birthdays[0] && birthdays[0].date ?
            `${birthdays[0].date.year}-${String(birthdays[0].date.month).padStart(2, '0')}-${String(birthdays[0].date.day).padStart(2, '0')}` :
            null;
        const notes = biographies ? biographies[0].value : '';


        await db.query('INSERT INTO contacts (user_id, name, phone, email, jobTitle, company, address, website, birthday, notes, syncGoogle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            req.session.user.id, name, phone, email, jobTitle, company, address, website, birthday, notes, true
        ]);
    }
    const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);

    res.json({ message: 'Google contacts successfully imported to your Spyke!', contacts: contacts, totalContacts: contacts.length });
});

//  5   -   Adicionar contactos

app.post('/addContact', isAuthenticated, async(req, res) => {
    const { name, phone, email, jobTitle, company, syncGoogle, address, website, birthday, notes } = req.body;
    const userId = req.session.user.id;

    const [duplicateContactByName] = await db.query('SELECT * FROM contacts WHERE user_id = ? AND name = ?', [userId, name]);

    if (duplicateContactByName.length > 0) {
        return res.json({ status: 'duplicate', attribute: 'name', message: 'You already have an existing contact with the same name.' });
    }

    const phoneValue = phone || '';
    const emailValue = email || '';
    const birthdayValue = birthday ? birthday : null;

    await db.query('INSERT INTO contacts (user_id, name, phone, email, jobTitle, company, syncGoogle, address, website, birthday, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [userId, name, phoneValue, emailValue, jobTitle, company, syncGoogle, address, website, birthdayValue, notes]);
    const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);

    let message = 'Contact successfully added!';

    if (syncGoogle) {
        if (!req.session.tokens || !req.session.tokens.access_token) {
            return res.json({ message: message });
        }

        oauth2Client.setCredentials(req.session.tokens);
        const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

        const contactDetails = {
            names: [{ givenName: name }],
            emailAddresses: email ? [{ value: email }] : [],
            phoneNumbers: phone ? [{ value: phone }] : [],
            organizations: [{ title: jobTitle || '', name: company || ''}],
            addresses: address ? [{ formattedValue: address }] : [],
            urls: website ? [{ value: website }] : [],
            birthdays: birthday ? [{
                date: {
                    year: parseInt(birthday.split('-')[0], 10),
                    month: parseInt(birthday.split('-')[1], 10),
                    day: parseInt(birthday.split('-')[2], 10)
                }
            }] : [],
            biographies: notes ? [{ value: notes }] : []
        };

        await contactsApi.people.createContact({
            requestBody: contactDetails
        });
        message = 'Contact added and synchronized with Google Contacts!';
    }
    res.json({ message, contacts: contacts, totalContacts: contacts.length });
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 90 registos limite / 60 segundos = 1.5 => não pode ultrapassar 1.5 solicitações por segundo

const batchSize = 10; // 10 contactos por batch --> 9 batches por minuto
const delayTime = 10000; // 60s / 9 batches ~= 7s --->  7 segundos por batch para não exceder o limite de 90 registos por minuto
                        //10s por batch para margem de segurança

app.post('/syncContacts', isAuthenticated, isGoogleAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const [contacts] = await db.query('SELECT * FROM contacts WHERE syncGoogle = TRUE AND user_id = ?', [userId]);

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    if (contacts.length === 0) {
        res.json({ success: false, message: 'No contacts available to sync' });
    } else {
        const googleContacts = await contactsApi.people.connections.list({
            resourceName: 'people/me',
            pageSize: 1000,
            personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies,metadata'
        });

        // Divide os contactos em grupos de 10 contactos
        const splitArrayIntoBatches = (array, batchSize) => {
            let result = [];
            for (let i = 0; i < array.length; i += batchSize) {
                result.push(array.slice(i, i + batchSize));
            }
            return result;
        };

        const contactBatches = splitArrayIntoBatches(contacts, batchSize);
        let readRequests = 0;
        let writeRequests = 0;

        for (let batch of contactBatches) {
            for (let contact of batch) {
                const birthdayDate = contact.birthday instanceof Date ? contact.birthday : new Date();
                const year = birthdayDate.getFullYear();
                const month = birthdayDate.getMonth() + 1;
                const day = birthdayDate.getDate();

                const contactDetails = {
                    names: [{ givenName: contact.name }],
                    emailAddresses: contact.email ? [{ value: contact.email }] : [],
                    phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
                    organizations: [{ title: contact.jobTitle || '', name: contact.company || '' }],
                    addresses: contact.address ? [{ formattedValue: contact.address }] : [],
                    urls: contact.website ? [{ value: contact.website }] : [],
                    birthdays: contact.birthday ? [{
                        date: {
                            year: year,
                            month: month,
                            day: day
                        }
                    }] : [],
                    biographies: contact.notes ? [{ value: contact.notes }] : []
                };

                const contactMatch = googleContacts.data.connections.find((googleContact) => {
                    const hasEmailMatch = contact.email && googleContact.emailAddresses && googleContact.emailAddresses.some(email => email.value === contact.email);
                    const hasPhoneMatch = contact.phone && googleContact.phoneNumbers && googleContact.phoneNumbers.some(phone => phone.value === contact.phone);
                    const hasNameMatch = googleContact.names && googleContact.names.some(name => name.displayName === contact.name);

                    return hasEmailMatch || hasPhoneMatch || hasNameMatch;
                });

                if (contactMatch) {
                    if (readRequests >= 85 || writeRequests >= 85) {
                        await delay(60000);
                        readRequests = 0;
                        writeRequests = 0;
                    }

                    const updatedContact = await contactsApi.people.get({
                        resourceName: contactMatch.resourceName,
                        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies,metadata'
                    });

                    readRequests++;

                    const etag = updatedContact.data.etag;
                    await contactsApi.people.updateContact({
                        resourceName: contactMatch.resourceName,
                        updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies',
                        requestBody: {
                            ...contactDetails,
                            etag: etag
                        }
                    });

                    writeRequests++;

                } else {
                    await contactsApi.people.createContact({
                        requestBody: contactDetails
                    });

                    writeRequests++;

                }
            }

            await delay(delayTime);
        }

        res.json({ success: true, message: 'Contact(s) successfully synchronized with Google!' });
    }
});

//  8   -   Editar contacto

//(Buscar dados do contacto selecionado quando carrego no botão de edit)

app.get('/contacts/:id', isAuthenticated, async (req, res) => {
    const contactId = req.params.id;
    const userId = req.session.user.id;

    const [contact] = await db.query('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [contactId, userId]);
    res.json(contact[0]);
});

app.post('/contacts/:id/update', isAuthenticated, async (req, res) => {

    const contactId = req.params.id;
    const { name, phone, email, jobTitle, company, address, website, birthday, notes } = req.body;
    const userId = req.session.user.id;

    try {
        await db.query('UPDATE contacts SET name = ?, phone = ?, email = ?, jobTitle = ?, company = ?, address = ?, website = ?, birthday = ?, notes = ? WHERE id = ? AND user_id = ?', 
            [name, phone, email, jobTitle, company, address, website, birthday, notes, contactId, userId]);
        const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
        res.json({ message: 'Contact updated!', contacts: contacts, totalContacts: contacts.length });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ message: 'Failed to update contact' });
    }
});

//  9   -   Apagar contacto

app.post('/contacts/:id/delete', isAuthenticated, async(req, res) => {
    const contactId = req.params.id;
    const userId = req.session.user.id;
    try {
        await db.query('DELETE FROM contacts WHERE id = ? AND user_id = ?', [contactId, userId]);

        const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
        res.json({contacts: contacts, totalContacts: contacts.length });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

//  10   -   Marcar como sync ativado / desativado

app.post('/contacts/:id/activateSync', isAuthenticated, async(req, res) => {

    const contactId = req.params.id;

    await db.query('UPDATE contacts SET syncGoogle = TRUE WHERE id = ?', [contactId]);
    res.json({ message: 'Sync option on!' });
})

app.post('/contacts/:id/deactivateSync', isAuthenticated, async(req, res) => {

    const contactId = req.params.id;

    await db.query('UPDATE contacts SET syncGoogle = FALSE WHERE id = ?', [contactId]);
    res.json({ message: 'Sync option off!' });

})

app.post('/contacts/:id/sync', isAuthenticated, isGoogleAuthenticated, async(req, res) => {

    const contactId = req.params.id;
    const [contactResult] = await db.query('SELECT * FROM contacts WHERE id = ?', [contactId]);

    const contact = contactResult[0];

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    if (!req.session.tokens || !req.session.tokens.access_token) {
        return res.json({ message: 'Google authentication required' });
    }

    const birthdayDate = contact.birthday instanceof Date ? contact.birthday : new Date();
    const year = birthdayDate.getFullYear();
    const month = birthdayDate.getMonth() + 1;
    const day = birthdayDate.getDate();

    const contactDetails = {
        
        names: [{ givenName: contact.name }],
        emailAddresses: contact.email ? [{ value: contact.email }] : [],
        phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
        organizations: [{title: contact.jobTitle || '', name: contact.company || ''}],
        addresses: contact.address ? [{ formattedValue: contact.address }] : [],
        urls: contact.website ? [{ value: contact.website }] : [],
        birthdays: contact.birthday ? [{
            date: {
                year: year,
                month: month,
                day: day
            }
        }] : [],
        biographies: contact.notes ? [{ value: contact.notes }] : []
    };

    const googleContacts = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies,metadata'
    });

    const contactMatch = googleContacts.data.connections.find((googleContact) => {
        const hasEmailMatch = contact.email && googleContact.emailAddresses && googleContact.emailAddresses.some(email => email.value === contact.email);
        const hasPhoneMatch = contact.phone && googleContact.phoneNumbers && googleContact.phoneNumbers.some(phone => phone.value === contact.phone);
        const hasNameMatch = googleContact.names && googleContact.names.some(name => name.displayName === contact.name);

        return hasEmailMatch || hasPhoneMatch || hasNameMatch;
    });

    if (contactMatch) {
        
        const updatedContact = await contactsApi.people.get({
            resourceName: contactMatch.resourceName,
            personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies,metadata'
        });

        const etag = updatedContact.data.etag;
        await contactsApi.people.updateContact({
            resourceName: contactMatch.resourceName,
            updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,birthdays,biographies',
            requestBody: {
                ...contactDetails,
                etag: etag
            }
        });
    } else {
        
        await contactsApi.people.createContact({
            requestBody: contactDetails
        });
    }

    res.json({ success: true, message: 'Contact successfully synchronized with Google!' });

})

app.get('/search/:search', isAuthenticated, async(req, res) => {
    const { search } = req.params;
    const userId = req.session.user.id;

    const [contacts] = await db.query('SELECT * FROM contacts WHERE name LIKE ? AND user_id = ?', [`%${search}%`, userId]);

    res.json(contacts);
})

app.get('/filter/:filter', isAuthenticated, async(req, res) => {

    const { filter } = req.params;
    const userId = req.session.user.id;

    let contacts;

    if (filter === 'on') {
        [contacts] = await db.query('SELECT * FROM contacts WHERE syncGoogle = TRUE AND user_id = ?', [userId]);
    }   else if (filter === 'off') {
        [contacts] = await db.query('SELECT * FROM contacts WHERE syncGoogle = FALSE AND user_id = ?', [userId]);
    }   else {
        [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
    }
    res.json(contacts);

})

//---------Port-------//
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor executado com sucesso em http://localhost:${PORT}`);
});