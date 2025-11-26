import { useCallback, useState } from "react";

export default function useAreaValidation(areaNames, areas, areaToggle){
    const [errorMessages, setErrorMessages] = useState([]);
    const [error, setError] = useState(false);

    const checkErrors = useCallback(() => {
        const messages = [];
        let hasError = false;

        if (areaToggle) {
            // Check for invalid area name
            const validChars = /^[a-zA-Z0-9\s]*$/;
            // allow alphanumeric input with length between 0 and 100
            areaNames.forEach(name => {
                if (name.length <= 0) {
                    hasError = true;
                    messages.push('Region names cannot be empty.')
                } else if (name.length >= 100) {
                    hasError = true;
                    messages.push('Region names cannot be longer than 100 characters.')
                }

                if (!validChars.test(name)) {
                    hasError = true;
                    messages.push('Region names cannot have non-alphanumeric characters.')
                }
            });

            // Check for invalid areas
            if (areaNames.length > areas.length) {
                hasError = true;
                messages.push('You must make region selection(s) before continuing.')
            }
        }
        setError(hasError);
        setErrorMessages(messages);
        return hasError;
    }, [areaToggle, areaNames, areas]);

    const clearErrors = useCallback(() => {
        setError(false);
        setErrorMessages([]);
    }, []);

    return {
        error,
        errorMessages,
        checkErrors,
        clearErrors
    };
}