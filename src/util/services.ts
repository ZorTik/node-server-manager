export type NSMObjectLabels = {
    id: string,
}

// Default labels to use in docker engine objects produced by NSM
export function constructObjectLabels({ id }: NSMObjectLabels) {
    return {
        'nsm': 'true',
        'nsm.id': id,
    }
}