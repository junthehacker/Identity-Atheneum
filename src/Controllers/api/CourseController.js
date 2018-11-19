// @flow
/*-------------------------------------
 * Controller for Course
 *
 * Author(s): Jun Zheng (me at jackzh dot com)
 --------------------------------------*/

const Container       = require('../../Models/Container');
const BadRequestError = require('../../Errors/BadRequestError');


/**
 * Controller instance, mostly static
 * @type {module.CourseController}
 */
module.exports = class CourseController {
    /**
     * List all courses
     * @param req
     * @param res
     */
    static async list(req: Request, res: express$Response) {
        let courses = await Container.getAllCourses('_id name content._name content._displayName tutorials');
        await Container.populateCoursesWithTutorials(courses, "_id name content._name content._displayName");
        res.send(courses);
    }

    /**
     * Get one course
     * @param req
     * @param res
     */
    static async get(req: Request, res: express$Response) {
        let course = await Container.findOneOrFail({_id: req.params.course_id});
        if (!course.isCourse()) {
            throw new BadRequestError("Container is not a course.");
        } else {
            await Container.populateCoursesWithTutorials([course], "_id name content._name content._displayName");
            res.send(course);
        }
    }

    /**
     * Get a list of students enrolled within the course
     * @param req
     * @param res
     */
    static async getStudents(req: Request, res: express$Response) {
        let course = await Container.findOneOrFail({_id: req.params.course_id});
        if (!course.isCourse()) {
            throw new BadRequestError("Container is not a course.");
        }
        let users = await course.getAllUsers('-attributes -__v');
        res.send(users);
    }

    /**
     * Get tutorials with in the course
     * @param req
     * @param res
     * @param next
     */
    static async getTutorials(req: Request, res: express$Response, next: express$NextFunction) {
        let course = await Container.findOneOrFail({_id: req.params.course_id});
        if (!course.isCourse()) {
            throw new BadRequestError("Container is not a course.");
        }
        await Container.populateCoursesWithTutorials([course], "_id name content._name content._displayName");
        res.send(course.tutorials);
    }

    /**
     * Get tutorial detail
     * @param req
     * @param res
     * @param next
     */
    static getTutorial(req: Request, res: express$Response, next: express$NextFunction) {
        if (req.application && req.isSecret) {
            // Find a course
            let course;
            Container.getCourseAndTutorialOrFailById(req.params.course_id, req.params.tutorial_id)
                .then(result => {
                    res.send(result.tutorial);
                })
                .catch(e => {
                    next(e);
                })
        } else {
            res.status(401);
            res.send("401");
        }
    }

    /**
     * Get all tutorial students
     * @param req
     * @param res
     * @param next
     */
    static getTutorialStudents(req: Request, res: express$Response, next: express$NextFunction) {
        if (req.application && req.isSecret) {
            // Find a course
            let course;
            Container.getCourseAndTutorialOrFailById(req.params.course_id, req.params.tutorial_id)
                .then(result => {
                    return result.tutorial.getAllUsers('-attributes -__v');
                })
                .then(users => {
                    res.send(users);
                })
                .catch(e => {
                    next(e);
                })
        } else {
            res.status(401);
            res.send("401");
        }
    }
};