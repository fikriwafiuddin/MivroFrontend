import { axiosInstance } from "@/lib/axios"
import type {
  Category,
  FormDataTransaction,
  SuccessResponse,
  Transaction,
  TransactionFilter,
} from "@/types"
import type { AxiosResponse } from "axios"

const create = async (
  data: Omit<FormDataTransaction, "time">,
  token: string,
) => {
  const response = await axiosInstance.post("/transactions", data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

const update = async (
  id: string,
  data: Omit<FormDataTransaction, "time">,
  token: string,
) => {
  const response = await axiosInstance.put(`/transactions/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

const remove = async (id: string, token: string) => {
  const response = await axiosInstance.delete(`/transactions/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return response.data
}

const getAll = async (request: TransactionFilter, token: string) => {
  const response: AxiosResponse<
    SuccessResponse<{ transactions: Transaction<Category>[] }>
  > = await axiosInstance.get("/transactions", {
    params: request,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return {
    transactions: response.data.data.transactions,
    filters: response.data.meta.filters,
    pagination: response.data.meta.pagination,
  }
}

const processOCR = async (image: File, token: string) => {
  const formData = new FormData()
  formData.append("image", image)

  const response = await axiosInstance.post("/transactions/ocr", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  })
  return response.data
}

const transactionApi = {
  create,
  update,
  remove,
  getAll,
  processOCR,
}
export default transactionApi
