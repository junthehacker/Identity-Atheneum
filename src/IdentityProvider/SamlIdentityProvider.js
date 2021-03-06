const IdentityProvider = require('./IdentityProvider');
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const express = require('express');
const fs = require('fs');
const User = require('../Models/User');
const sanitizeKeysForMongo = require('../Util/sanitizeKeysForMongo');
const getRealUrl = require('../Util/getRealUrl');

class SamlIdentityProvider extends IdentityProvider {
    initialize() {

        this.strategy = new SamlStrategy(
            {
                callbackUrl: this.config.config.callback_url,
                entryPoint: this.config.config.entry_point,
                issuer: this.config.config.issuer,
                signatureAlgorithm: this.config.config.signature_algo,
                // TODO: Validate signature of the IdP
                // cert: fs.readFileSync(this.config.config.cert, 'utf8'),
                privateCert: fs.readFileSync(this.config.config.private_key, 'utf8'),
                decryptionPvk: fs.readFileSync(this.config.config.private_key, 'utf8'),
                identifierFormat: this.config.config.identifier_format,
                acceptedClockSkewMs: 180,
                forceAuthn: true
            },
            (profile, done) => {
                // Ensure a user with nameID exist within the database
                User.findOne({ username: profile[this.config.config.id_key], idp: this.config.name })
                    .then(user => {
                        if(user) {
                            // If we have a user, then let's update its attribute
                            user.attributes = {
                                ...user.attributes,
                                ...sanitizeKeysForMongo(profile)
                            };
                            return user.save();
                        } else {
                            // Otherwise we create the user
                            console.log(profile);
                            let newUser = new User({
                                username: profile[this.config.config.id_key],
                                idp: this.config.name,
                                attributes: sanitizeKeysForMongo(profile)
                            });
                            return newUser.save();
                        }
                    })
                    .then(user => {
                        if(user) {
                            done(null, user);
                        }
                    })
                    .catch(e => done(e));
            }
        );

        passport.use(this.strategy);

        console.log(("SAML IdP " + this.config.name.bold + " initialized.").green);
    }

    mount(app) {
        const router = express.Router();

        router.get('/login',
            passport.authenticate('saml', {
                failureRedirect: getRealUrl('/'),
                failureFlash: true
            }),
            function (req, res) {
                res.redirect(getRealUrl('/session'));
            }
        );

        // If we have special binding
        if(this.config.config.callback_binding) {
            app.post(this.config.config.callback_binding,
                passport.authenticate('saml', {
                    failureRedirect: getRealUrl('/'),
                    failureFlash: true
                }),
                function(req, res) {
                    res.redirect(getRealUrl('/login_success'));
                });
        }

        router.get('/metadata', (req, res) => {
            res.setHeader('content-type', 'application/xml');
            res.send(this.strategy.generateServiceProviderMetadata(fs.readFileSync(this.config.config.public_cert, 'utf8')));
        });


        router.post('/login',
            passport.authenticate('saml', {
                failureRedirect: getRealUrl('/'),
                failureFlash: true
            }),
            function(req, res) {
                res.redirect(getRealUrl('/login_success'));
            }
        );

        app.use('/idps/' + this.config.name, router);

        console.log(("/idps/" + this.config.name.bold + " mounted.").green);
    }
}

module.exports = SamlIdentityProvider;
