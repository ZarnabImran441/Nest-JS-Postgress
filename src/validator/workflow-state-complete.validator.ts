import {ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface} from 'class-validator';
import {CreateWorkFlowStateDto} from '../dto/workflow/create-workflow-state.dto';

@ValidatorConstraint({name: 'WorkFlowStateComplete', async: false})
export class WorkFlowStateComplete implements ValidatorConstraintInterface {
    validate(arr: CreateWorkFlowStateDto[], _args: ValidationArguments): boolean {
        let i = 0;
        for (const state of arr) {
            if (state.completed === true) {
                i++;
            }
        }
        return i === 1; // for async validations you must return a Promise<boolean> here
    }

    defaultMessage(_args: ValidationArguments): string {
        // here you can provide default error message if validation failed
        return 'There must be a state with completed status.';
    }
}
