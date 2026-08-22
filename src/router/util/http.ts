import express from "express";

export const sendPlainText = (res: express.Response, data: string) => {
  return res.status(200).type("text/plain; charset=utf-8").send(data);
}