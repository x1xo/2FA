import {detectEncoding, encrypt, getUser, timestampOfNextCode} from "$lib/utils.js"
import {redirect, fail} from '@sveltejs/kit'
import {PRIVATE_USERNAME, PRIVATE_PASSWORD,SECRET } from "$env/static/private"
import { accounts } from "$lib/account.js"
import speakeasy from 'speakeasy'

/** @type {import('./$types').Actions} */
export const actions = {
    login: async ({ request, cookies }) => {
        const data = await request.formData();
        const username = data.get('username');
        const password = data.get('password');
        const remember = data.get('remember');

        if (!username || !password) {
            return fail(400, {
                error: 'Please enter a username and password'
            });
        }
        if(username != PRIVATE_USERNAME || password != PRIVATE_PASSWORD){
            console.log(username, password, PRIVATE_USERNAME, PRIVATE_PASSWORD)
            return fail(400, {
                error: 'Invalid username or password'
            });
        }

        const sid = await encrypt(username+password,SECRET);
        cookies.set("sid", sid, {path:'/', maxAge: remember ? 60 * 60 * 24 * 7 : 1 * 60 * 60});
        return redirect(302, "/")
    },

    logout: ({ cookies }) => {
        cookies.delete("sid", {path:'/'})
        return redirect(302, "/")
    },

    create: async ({request, cookies}) => {
        const data = await request.formData();
        let name = data.get('name');
        let secret = data.get('secret');
        let notes = data.get('notes');
        
        if (!name || !secret) {
            return fail(400, {
                error: 'Please enter a name and secret'
            });
        }

        const user = await getUser(cookies.get("sid"))
        if(!user) return fail(401, {
            error: 'unauthenticated'
        })

        secret = secret.split(" ").join("").trim();

        const code = speakeasy.totp({secret, encoding: detectEncoding(secret)});
        if(!code) {
            return fail(400, {
                error: 'Something went wrong.'
            });
        }

        const time = timestampOfNextCode();


        const account = new accounts({
            name: name,
            secret: secret,
            notes: notes
        })

        await account.save().catch(err => console.log("Error while saving new account."));

        return {
            name,
            code: {code, expires: time},
            notes,
        }
    },

    delete: async ({request, cookies}) => {
        const data = await request.formData();
        const id = data.get("id");

        const user = await getUser(cookies.get("sid"))
        if(!user) return fail(401, {
            error: 'unauthenticated'
        })

        let acc = await accounts.findOneAndDelete({_id: id});
        if (!acc) {
            return fail(400, {
                error: 'Something went wrong.'
            });
        }

        return "OK"
    },

    edit: async ({request, cookies}) => {
        const data = await request.formData();
        const id = data.get("id");
        let name = data.get("name");
        let secret = data.get("secret");
        let notes = data.get("notes");
        
        const user = await getUser(cookies.get("sid"))
        if(!user) return fail(401, {
            error: 'unauthenticated'
        })

        if(secret && secret.length == 0) {
            secret = secret.split(" ").join("").trim();
            const code = totp({secret, encoding: detectEncoding(secret)});
            if(!code) {
                return fail(400, {
                    error: 'Something went wrong.'
                });
            }
        }

        const account = await accounts.findOneAndUpdate({_id: id}, {name, secret, notes});
    
        if (!account) return fail(500, {
            error: 'Something went wrong.'
        });

        return {
            name,
            notes,
        }
    }
};

