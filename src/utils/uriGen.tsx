const URIGen = (placeName: string, placeId: number, dateStr: string) => {
    const slug = placeName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, '-'); 

    let uri = `/place/${slug}-${placeId}`;

    if (dateStr) {
        uri += `?date=${dateStr}`;
    }

    return uri;
}

export default URIGen;