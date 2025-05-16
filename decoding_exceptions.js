class UnknownLNSException extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }

    getMessage = function() {
        return this.message;
    }
}

class UselessFrame extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }

    getMessage = function() {
        return this.message;
    }
}


class UnprocessableFrame extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


class MalformedFrame extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}


module.exports = {
    UnknownLNSException,
    UselessFrame,
    UnprocessableFrame,
    MalformedFrame
};