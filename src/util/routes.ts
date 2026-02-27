export function handleErr(e: any, res: any) {
    if (e.code) {
        switch (e.code) {
            case 2:
                res.status(409).json({status: 409, message: e.message});
                return;
            case 3:
                res.status(404).json({status: 404, message: e.message});
                return;
        }
    }
    res.status(500).json({status: 500, message: e.message});
}

export function handleErrorMessage(status: number, message: string, res: any) {
    res.status(status).json({status, message});
}