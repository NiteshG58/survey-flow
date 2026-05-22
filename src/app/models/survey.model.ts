export interface SurveyOption {
    id: string | number;
    optText: string;
    status: number;
    optSeq?: number;
    islock?: boolean;
    startAge?: number;
    endAge?: number;
}

export interface SurveyQuestion {
    id: number;
    questionKey: string;
    questionText: string;
    questionType: number | string;
    seq: number;
    opts: SurveyOption[];
    questionOptions?: SurveyOption[]; // used in some places
    displayOrder?: number;
    lengthAllowed?: number;
}

export interface SurveyDetails {
    id: number;
    prj_id: number;
    nm: string;
    st: number;
    N: number;
    CPI: number;
    Url?: string;
    test_url?: string;
    test_url_typ?: string;
    screenerBypass?: boolean;
    resrchDfdChk?: number;
    resrchDfdActCheck?: number;
}

export interface SurveyTransaction {
    id: string;
    mbr_id: string;
    prj_id: number;
    ip: string;
    dvc_typ: string;
    sup_id: string | number;
    is_cmp: number;
    mid: string;
}

export enum QuestionType {
    SINGLE_PUNCH = 0,
    MULTI_PUNCH = 1,
    OPEN_END_TEXT = 2,
    NUMERIC_OPEN_END_TEXT = 3
}
