// TypeScript declarations for MSG91 Custom Web SDK

export interface Msg91Configuration {
  widgetId: string;
  tokenAuth?: string;
  exposeMethods?: boolean;
  captchaRenderId?: string;
  success?: (data: any) => void;
  failure?: (error: any) => void;
}

export interface Msg91SuccessResponse {
  message?: string;
  reqId?: string;
  type?: string;
  [key: string]: any;
}

export interface Msg91VerifyResponse {
  message?: string;
  type?: string;
  token?: string;
  accessToken?: string;
  reqId?: string;
  [key: string]: any;
}

export interface Msg91ErrorResponse {
  message?: string;
  code?: string | number;
  type?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    initSendOTP?: (config: Msg91Configuration) => void;
    sendOtp?: (
      identifier: string,
      success?: (data: Msg91SuccessResponse) => void,
      failure?: (error: Msg91ErrorResponse) => void
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: Msg91SuccessResponse) => void,
      failure?: (error: Msg91ErrorResponse) => void,
      reqId?: string
    ) => void;
    verifyOtp?: (
      otp: string,
      success?: (data: Msg91VerifyResponse) => void,
      failure?: (error: Msg91ErrorResponse) => void,
      reqId?: string
    ) => void;
    isCaptchaVerified?: () => boolean;
    getWidgetData?: () => any;
  }
}
