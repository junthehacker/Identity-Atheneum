const User = require('../../Models/User');
const Application = require('../../Models/Application');
const Container = require('../../Models/Container');
const getRealUrl = require('../../Util/getRealUrl');
const isValidGroupName = require('../../Util/isValidGroupName');
const flattenFlashMessages = require('../../Util/flattenFlashMessages');
const config = require('../../config');

module.exports = class AdminDashboardController {
    /**
     * Render home page
     * @param req
     * @param res
     */
    static homePage(req, res) {
        User.find({})
            .then(users => {
                res.render('pages/admin/home', {
                    title: "Admin Dashboard",
                    users,
                    getRealUrl
                });
            });
    }

    /**
     * Render user listing page
     * @param req
     * @param res
     */
    static usersPage(req, res) {
        User.find({
            idp: {$regex: req.query.idp || /.*/},
            groups: {$regex: req.query.group || /.*/}
        })
            .then(users => {
                res.render('pages/admin/users', {
                    title: "Users - Admin Dashboard",
                    users,
                    req,
                    getRealUrl,
                    ...flattenFlashMessages(req)
                });
            });
    }

    /**
     * Render create new users page
     * @param req
     * @param res
     */
    static createNewUsersPage(req, res) {
        res.render('pages/admin/createUsers', {
            title: "Create New Users - Admin Dashboard",
            getRealUrl,
            ...flattenFlashMessages(req)
        })
    }

    /**
     * Create a list of users
     * @param req
     * @param res
     */
    static createUsers(req, res) {
        // First get all users
        if (!req.body.users) {
            req.flash("errors", "You must have at least one user.");
            res.redirect(getRealUrl('/admin/users/create_users'));
        } else {
            let chain = [];
            // Parse every user
            let input = req.body.users.split(/\r?\n/);
            for (let i = 0; i < input.length; i++) {
                let line = input[i].split(/\s+/);
                chain.push(new Promise((resolve, reject) => {
                    if (line.length < 3) {
                        req.flash("errors", `Error on line ${i}, invalid number of arguments.`);
                        return resolve();
                    }
                    // Otherwise we create the user
                    User.create(line[0], line[1], line[2], "", line.splice(3), {})
                        .then(user => {
                            req.flash("success", `User created with ID ${user._id}.`);
                            resolve();
                        })
                        .catch(e => {
                            req.flash("errors", e.message);
                            resolve();
                        })
                }));
            }
            Promise.all(chain)
                .then(() => {
                    res.redirect(getRealUrl('/admin/users/create_users'));
                })
                .catch(e => {
                    res.redirect(getRealUrl('/admin/users/create_users'));
                })
        }
    }

    /**
     * Export user list in JSON format
     * @param req
     * @param res
     * @param next
     */
    static exportUsersJSON(req, res, next) {
        User.find({})
            .then(users => {
                res.header('content-type', 'application/json');
                res.send(JSON.stringify(users));
            })
            .catch(e => next(e));
    }

    /**
     * GET /users/detail/:identifier
     * Get user details page
     * @param req
     * @param res
     * @param next
     */
    static userDetailPage(req, res, next) {
        User.findByIdentifier(req.params.identifier)
            .then(user => {
                if (user) {
                    res.render('pages/admin/userDetail', {
                        title: user.getReadableId() + " Detail - Admin Dashboard",
                        req, getRealUrl, user,
                        ...flattenFlashMessages(req)
                    })
                } else {
                    res.send("User not found.");
                }
            })
            .catch(e => next(e));
    }

    /**
     * POST /users/detail/:identifier/add_group
     * Add a new group to user
     * @param req
     * @param res
     * @param next
     */
    static addGroupToUser(req, res, next) {
        User.findByIdentifier(req.params.identifier)
            .then(user => {
                if (user) {
                    if (!req.body.name) {
                        throw new Error("You must enter a group name.");
                    } else if (!isValidGroupName(req.body.name)) {
                        throw new Error("Group name invalid, can only contain a-z, 0-9 and .");
                    } else if (user.groups.indexOf(req.body.name) >= 0) {
                        throw new Error("Group already exist.");
                    } else {
                        user.groups.push(req.body.name);
                        return user.save();
                    }
                } else {
                    throw new Error("User not found.");
                }
            })
            .then(() => {
                req.flash("success", "Group added.");
                res.redirect(getRealUrl('/admin/users/detail/' + req.params.identifier));
            })
            .catch(e => {
                req.flash("errors", e.message);
                res.redirect(getRealUrl('/admin/users/detail/' + req.params.identifier));
            })
    }

    /**
     * POST /users/detail/:identifier/delete_group
     * Remove a group from user
     * @param req
     * @param res
     * @param next
     */
    static deleteGroupFromUser(req, res, next) {
        User.findByIdentifier(req.params.identifier)
            .then(user => {
                if (user) {
                    if (!req.body.name) {
                        throw new Error("You must enter a group name.");
                    } else if (user.groups.indexOf(req.body.name) < 0) {
                        throw new Error("Group does not exist.");
                    } else {
                        let index = user.groups.indexOf(req.body.name);
                        user.groups.splice(index, 1);
                        return user.save();
                    }
                } else {
                    throw new Error("User not found.");
                }
            })
            .then(() => {
                req.flash("success", "Group removed.");
                res.redirect(getRealUrl('/admin/users/detail/' + req.params.identifier));
            })
            .catch(e => {
                req.flash("errors", e.message);
                res.redirect(getRealUrl('/admin/users/detail/' + req.params.identifier));
            })
    }

    /**
     * POST /users/detail/:identifier/delete
     * Delete an user
     * @param req
     * @param res
     * @param next
     */
    static deleteUser(req, res, next) {
        User.findByIdentifier(req.params.identifier)
            .then(user => {
                if (user) {
                    return user.remove();
                } else {
                    throw new Error("User not found.");
                }
            })
            .then(() => {
                req.flash("success", "User removed.");
                res.redirect(getRealUrl('/admin/users'));
            })
            .catch(e => {
                req.flash("errors", e.message);
                res.redirect(getRealUrl('/admin/users'));
            })
    }

    /**
     * Render applications page
     * @param req
     * @param res
     * @param next
     */
    static applicationsPage(req, res, next) {
        Application.find({})
            .then(applications => {
                res.render('pages/admin/applications', {
                    title: "Applications - Admin Dashboard",
                    applications,
                    req,
                    getRealUrl,
                    ...flattenFlashMessages(req)
                });
            });
    }

    /**
     * Delete an application
     * @param req
     * @param res
     */
    static deleteApplication(req, res) {
        Application.findOne({_id: req.params.id})
            .then(app => {
                if (!app) {
                    throw new Error("Application not found.");
                } else {
                    return app.remove();
                }
            })
            .then(() => {
                req.flash("success", "Application removed.");
                res.redirect(getRealUrl('/admin/applications'));
            })
            .catch(e => {
                req.flash("errors", e.message);
                res.redirect(getRealUrl('/admin/applications'));
            })
    }

    /**
     * GET /system
     * Get systems page
     * @param req
     * @param res
     */
    static systemPage(req, res) {
        res.render('pages/admin/system', {
            getRealUrl,
            config,
            ...flattenFlashMessages(req)
        });
    }

    /**
     * GET /containers
     * Render containers page
     * @param req
     * @param res
     */
    static containersPage(req, res) {
        Container.find({})
            .then(containers => {
                res.render('pages/admin/containers', {
                    getRealUrl,
                    containers,
                    ...flattenFlashMessages(req)
                })
            });
    }

    /**
     * GET /containers/create_container
     * Render create container page
     * @param req
     * @param res
     */
    static createContainerPage(req, res) {
        res.render('pages/admin/createContainer', {
            getRealUrl,
            ...flattenFlashMessages(req)
        })
    }

    /**
     * POST /containers/create_container
     * Create a new container
     * @param req
     * @param res
     */
    static createContainer(req, res) {
        Container.create(req.body.name, req.body.read_groups, req.body.write_groups, req.body.delete_groups)
            .then(container => {
                req.flash("success", "Container created " + container._id + ".");
                res.redirect(getRealUrl('/admin/containers'));
            })
            .catch(e => {
                req.flash("errors", e.message);
                res.redirect(getRealUrl('/admin/containers'));
            })
    }

    /**
     * GET /containers/detail/:name
     * Render container details page
     * @param req
     * @param res
     */
    static containerDetailPage(req, res) {
        Container.findOne({name: req.params.name})
            .then(container => {
                if(container) {
                    res.render('pages/admin/containerDetail', {
                        getRealUrl,
                        container,
                        ...flattenFlashMessages(req)
                    });
                } else {
                    res.send("Container not found.");
                }
            })
    }

    /**
     * Export container into JSON format
     * @param req
     * @param res
     */
    static exportContainerJSON(req, res) {
        Container.findOne({name: req.params.name})
            .then(container => {
                if(container) {
                    res.header('content-type', 'application/json');
                    res.send(JSON.stringify(container));
                } else {
                    res.send("Container not found.");
                }
            })
    }
};
