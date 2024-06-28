import {ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';

@ValidatorConstraint({name: 'isNumberOrStringArray', async: false})
export class IsNumberOrStringArray implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        // Check if the value is an array
        if (!Array.isArray(value)) {
            return false;
        }

        // Check if all elements are either numbers or strings
        const arrayOfNumbers = value.every((item) => typeof item === 'number');
        const arrayOfStrings = value.every((item) => typeof item === 'string');

        return arrayOfNumbers || arrayOfStrings;
    }

    defaultMessage(): string {
        return 'Values must be an array of numbers or strings.';
    }
}
