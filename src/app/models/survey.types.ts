export interface SurveyQuestion {
    id: number;
    questionKey: string;
    questionText: string;
    questionType: number;
    questionOptions?: SurveyOption[];
    termOpts?: any[];
    termsCount?: number;
    expiry?: string;
    locId?: string;
}

export interface SurveyOption {
    id: number;
    optText: string;
    isExclusive?: boolean;
    selectOnlyOpt?: number;
    startAge?: string;
    endAge?: string;
}

export interface SurveyTransaction {
    mbr_id: string | number;
    is_cmp: boolean;
    RIDResp?: {
        RVid: string;
    };
}

export enum QuestionType {
    SINGLE_PUNCH = 0,
    MULTI_PUNCH = 1,
    OPEN_END_TEXT = 2,
    NUMERIC_OPEN_END_TEXT = 3
}

export interface LocalStorageAnswer {
    question_id: number | string;
    question_type: number | string;
    question_key: string;
    option_id: string | number;
    answer: any;
    terminate: boolean;
    question_text?: string;
    option_text?: string;
    expiry?: string;
    locId?: string;
}
