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
        scope: SCOPES
    });
    res.redirect(authUrl);
});

//Obter código de autorização, autorizar e atribuir token à sessão
app.get('/google/callback', isAuthenticated, async(req, res) => {

    const { code } = req.query; 
    const { tokens } = await oauth2Client.getToken(code); 

    if (tokens.refresh_token) {
        req.session.refresh_token = tokens.refresh_token;
    }

    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.redirect('/spyke');

});

async function refreshAccessToken(req, res, next) {
    if (!oauth2Client.credentials || !oauth2Client.credentials.expiry_date || oauth2Client.credentials.expiry_date <= Date.now()) {
        if (req.session.refresh_token) {
            try {
                const newTokens = await oauth2Client.refreshToken(req.session.refresh_token);
                oauth2Client.setCredentials(newTokens.tokens);
                req.session.tokens = newTokens.tokens;
            } catch (err) {
                return res.redirect('/auth/google');
            }
        } else {
            return res.redirect('/auth/google');
        }
    }
    next();
}

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

app.get('/googleContactsData', refreshAccessToken, isAuthenticated, isGoogleAuthenticated, async(req, res) => {

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    const response = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        personFields: 'names,emailAddresses,phoneNumbers'
    });
    const contacts = response.data.connections;
    res.json(contacts);
});

//  4   -   Importar os contactos do google e meter na app

app.get('/importGoogleContacts', refreshAccessToken, isAuthenticated, isGoogleAuthenticated, async(req, res) => {

    const userId = req.session.user.id;

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    const response = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        personFields: 'names,emailAddresses,phoneNumbers'
    });
    const googleContacts = response.data.connections;

    for (let contact of googleContacts) {
        const { names, phoneNumbers, emailAddresses } = contact;
        const name = names ? names[0].givenName : '';
        const email = emailAddresses ? emailAddresses[0].value : '';
        const phone = phoneNumbers ? phoneNumbers[0].value : '';


        await db.query('INSERT INTO contacts (user_id, name, phone, email, syncGoogle) VALUES (?, ?, ?, ?, ?)', [
            req.session.user.id, name, phone, email, true
        ]);
    }
    const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);

    res.json({ message: 'Google contacts successfully imported to your Spyke!', contacts: contacts, totalContacts: contacts.length });

});

//  5   -   Adicionar contactos

app.post('/addContact', isAuthenticated, async(req, res) => {
    const { name, phone, email, syncGoogle } = req.body;
    const userId = req.session.user.id;

    const [duplicateContactByName] = await db.query('SELECT * FROM contacts WHERE user_id = ? AND name = ?', [userId, name]);
    const [duplicateContactByPhone] = await db.query('SELECT * FROM contacts WHERE user_id = ? AND phone = ?', [userId, phone]);

    if (duplicateContactByName.length > 0 && duplicateContactByPhone.length > 0) {
        return res.json({ status: 'duplicate', attribute: 'namePhone', message: 'You already have an existing contact with the same name and phone number.' });
    } else if (duplicateContactByName.length > 0) {
        return res.json({ status: 'duplicate', attribute: 'name', message: 'You already have an existing contact with the same name.' });
    } else if (duplicateContactByPhone.length > 0) {
        return res.json({ status: 'duplicate', attribute: 'phone', message: 'You already have an existing contact with the same phone number.' });
    }

    await db.query('INSERT INTO contacts (user_id, name, phone, email, syncGoogle) VALUES (?, ?, ?, ?, ?)', [userId, name, phone, email, syncGoogle]);
    const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);

    let message = 'Contact successfully added!';

    if (syncGoogle) {
        if (!req.session.tokens || !req.session.tokens.access_token) {
            return res.json({ message: 'Google authentication required' });
        }

        oauth2Client.setCredentials(req.session.tokens);
        const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

        const contactDetails = {
            names: [{ givenName: name }],
            emailAddresses: email ? [{ value: email }] : [],
            phoneNumbers: phone ? [{ value: phone }] : [],
        };

        await contactsApi.people.createContact({
            requestBody: contactDetails
        });
        message = 'Contact added and synchronized with Google Contacts!';
    }
    res.json({ message, contacts: contacts, totalContacts: contacts.length });
});

function delay(ms) {
    return new Promise(function(resolve) {
        setTimeout(resolve, ms);
    });
}

const delayTime = 700;

//  6   -   Sincronizar contactos com google

app.post('/syncContacts', isAuthenticated, isGoogleAuthenticated, refreshAccessToken, async(req, res) => {

    const userId = req.session.user.id;

    const [ contacts ] = await db.query('SELECT * FROM contacts WHERE syncGoogle = TRUE AND user_id = ?', [userId])

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    if (contacts.length === 0) {
        res.json({ success: false, message: 'No contacts available to sync'});
    } else {


        const googleContacts = await contactsApi.people.connections.list({
            resourceName: 'people/me',
            pageSize: 100,
            personFields: 'names,emailAddresses,phoneNumbers,metadata'
        });

        for (let contact of contacts) {
            const contactDetails = {
                names: [{ givenName: contact.name }],
                emailAddresses: contact.email ? [{ value: contact.email }] : [],
                phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
            };

            const contactMatch = googleContacts.data.connections.find((googleContact) => {
                const hasEmailMatch = contact.email && googleContact.emailAddresses && googleContact.emailAddresses.some(email => email.value === contact.email);
                const hasPhoneMatch = contact.phone && googleContact.phoneNumbers && googleContact.phoneNumbers.some(phone => phone.value === contact.phone);
                const hasNameMatch = googleContact.names && googleContact.names.some(name => name.displayName === contact.name);

                return hasEmailMatch || hasPhoneMatch || hasNameMatch;
            });

            if (contactMatch) {
                const updatedContact = await contactsApi.people.get({
                    resourceName: contactMatch.resourceName,
                    personFields: 'names,emailAddresses,phoneNumbers,metadata'
                });

                const etag = updatedContact.data.etag;
                await contactsApi.people.updateContact({
                    resourceName: contactMatch.resourceName,
                    updatePersonFields: 'names,emailAddresses,phoneNumbers',
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

            await delay(delayTime);
        }
        res.json({ success: true, message: 'Contact(s) successfully synchronized with Google!'});
    }
})

//  7   -   Sincronizar aquando da configuração do google account

app.post('/syncContacts/googleConfig', isAuthenticated, isGoogleAuthenticated, refreshAccessToken, async(req, res) => {

    const userId = req.session.user.id;

    const [ contacts ] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    if (contacts.length === 0) {
        res.json({ success: false, message: 'No contacts available to sync'});
    } else {


        const googleContacts = await contactsApi.people.connections.list({
            resourceName: 'people/me',
            pageSize: 100,
            personFields: 'names,emailAddresses,phoneNumbers,metadata'
        });

        for (let contact of contacts) {
            const contactDetails = {
                names: [{ givenName: contact.name }],
                emailAddresses: contact.email ? [{ value: contact.email }] : [],
                phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
            };

            const contactMatch = googleContacts.data.connections.find((googleContact) => {
                return (contact.email && googleContact.emailAddresses && googleContact.emailAddresses.some(email => email.value === contact.email)) ||
                (contact.phone && googleContact.phoneNumbers && googleContact.phoneNumbers.some(phone => phone.value === contact.phone));
            });

            if (contactMatch) {
                const updatedContact = await contactsApi.people.get({
                    resourceName: contactMatch.resourceName,
                    personFields: 'names,emailAddresses,phoneNumbers,metadata'
                });

                const etag = updatedContact.data.etag;
                await contactsApi.people.updateContact({
                    resourceName: contactMatch.resourceName,
                    updatePersonFields: 'names,emailAddresses,phoneNumbers',
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

            await delay(delayTime);
        }
        res.json({ success: true, message: 'All Spyke contacts successfully synchronized with Google!'});
    }
})

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
    const { name, phone, email } = req.body;
    const userId = req.session.user.id;

    try {
        await db.query('UPDATE contacts SET name = ?, phone = ?, email = ? WHERE id = ? AND user_id = ?', [name, phone, email, contactId, userId]);
        const [contacts] = await db.query('SELECT * FROM contacts WHERE user_id = ?', [userId]);
        res.json({ message: 'Contact updated!', contacts: contacts, totalContacts: contacts.length });
    } catch (error) {
        console.error(error);
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

app.post('/contacts/:id/sync', isAuthenticated, isGoogleAuthenticated, refreshAccessToken, async(req, res) => {

    const contactId = req.params.id;
    const [contactResult] = await db.query('SELECT * FROM contacts WHERE id = ?', [contactId]);

    const contact = contactResult[0];

    oauth2Client.setCredentials(req.session.tokens);
    const contactsApi = google.people({ version: 'v1', auth: oauth2Client });

    if (!req.session.tokens || !req.session.tokens.access_token) {
        return res.json({ message: 'Google authentication required' });
    }

    const contactDetails = {
        names: [{ givenName: contact.name }],
        emailAddresses: contact.email ? [{ value: contact.email }] : [],
        phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
    };

    const googleContacts = await contactsApi.people.connections.list({
        resourceName: 'people/me',
        pageSize: 100,
        personFields: 'names,emailAddresses,phoneNumbers,metadata'
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
            personFields: 'names,emailAddresses,phoneNumbers,metadata'
        });

        const etag = updatedContact.data.etag;
        await contactsApi.people.updateContact({
            resourceName: contactMatch.resourceName,
            updatePersonFields: 'names,emailAddresses,phoneNumbers',
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