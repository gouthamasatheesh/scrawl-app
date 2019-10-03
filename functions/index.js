const functions = require('firebase-functions');
const admin = require('firebase-admin');
const app = require('express')();

admin.initializeApp();

const config = {
    apiKey: "AIzaSyBr_DioZuSr55mb7TOUIOS37iAZ4APBNVw",
    authDomain: "scrawl-82284.firebaseapp.com",
    databaseURL: "https://scrawl-82284.firebaseio.com",
    projectId: "scrawl-82284",
    storageBucket: "scrawl-82284.appspot.com",
    messagingSenderId: "53836294548",
};

const firebase = require('firebase');
firebase.initializeApp(config);

const db = admin.firestore();

app.get('/screams', (request, response) => {
    db
        .collection('screams')
        .get()
        .then((data) => {
            let screams = [];
            data.forEach((doc) => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                });
            });
            return response.json(screams);
        })
        .catch((err) => console.error(err));
})

const FBAuth = (request, response, next) => {
    let idToken;
    if(request.headers.authorization && request.headers.authorization.startsWith('Bearer ')){
        idToken = request.headers.authorization.split('Bearer ')[1];
    }
    else{
        console.error('No token found');
        return response.status(403).json({ error: 'Unauthorized' });
    }
    
}

app.post('/scream', FBAuth, (request, response) => {
    const newScream = {
        body: request.body.body,
        userHandle: request.body.userHandle,
        createdAt: new Date().toISOString()
    };
    db
        .collection('screams')
        .add(newScream)
        .then((doc) => {
            response.json({message: `document ${doc.id} created successfully`});
        })
        .catch((err) => {
            console.error(err);
            response.status(500).json({error: 'something went wrong'});
        })
})

//Signup route
const isEmpty = (string) => {
    if(string.trim() === '') return true;
    else return false;
}
const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    else return false;
}

let token, userId;
app.post('/signup', (request, response) => {
    const newUser = {
        email: request.body.email,
        password: request.body.password,
        confirmPassword: request.body.confirmPassword,
        handle: request.body.handle
    };

    let errors = {};

    if(isEmpty(newUser.email)) errors.email = 'must not be empty';
    else if(!isEmail(newUser.email)) errors.email = 'must be a valid email address';
    if(isEmpty(newUser.password)) errors.password = 'must not be empty';
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = 'passwords must match'
    if(isEmpty(newUser.handle)) errors.handle = 'must not be empty';

    if(Object.keys(errors).length > 0) return response.status(400).json(errors);

    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if(doc.exists){
                return response.status(400).json({handle: 'this handle already exist'})
            }
            else{
                return firebase
                        .auth()
                        .createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then((idToken) => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return response.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if(err.code === 'auth/email-already-in-use'){
                return response.status(400).json({ email: 'This email is already taken'})
            }
            else{
                return response.status(500).json({ error: err.code });
            }
        })
});

//Login route
app.post('/login', (request, response) => {
    const user = {
        email: request.body.email,
        password: request.body.password
    };

    let errors = {};

    if(isEmpty(user.email)) errors.email = 'must not be empty';
    if(isEmpty(user.password)) errors.password = 'must not be empty';

    if(Object.keys(errors).length > 0) return response.status(400).json(errors);

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return response.json({ token });
        })
        .catch(err => {
            console.error(err);
            if(err.code === 'auth/wrong-password') return response.status(400).json({ email: 'Wrong password'});
            if(err.code === 'auth/user-not-found') return response.status(400).json({ email: 'Wrong Email'});            
            return response.status(500).json({error: err.code});
        })
})

exports.api = functions.https.onRequest(app);