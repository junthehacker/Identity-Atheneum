const NotFoundError = require('../Errors/NotFoundError');

module.exports = exports = function lastModifiedPlugin (schema, options) {
    schema.statics.findOneOrFail = function(filter) {
        return new Promise((resolve, reject) => {
            this.findOne(filter)
                .then(obj => {
                    if(obj) resolve(obj);
                    else throw new NotFoundError("Cannot find the item.");
                })
                .catch(e => reject(e));
        })
    };
};
