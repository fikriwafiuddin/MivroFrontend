import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { zodResolver } from "@hookform/resolvers/zod"
import transactionValidation from "@/lib/validations/transaction-validation"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import type {
  ErrorResponse,
  FormDataTransaction,
  Transaction,
  TransactionFieldErrors,
} from "@/types"
import {
  useCreateTransaction,
  useProcessOCRTransaction,
  useUpdateTransaction,
} from "@/services/hooks/transactionHook"
import { useNavigate } from "react-router"
import type { AxiosError } from "axios"
import { useGetAllCategories } from "@/services/hooks/categoryHook"
import { useMemo } from "react"
import CategoryItemSkeleton from "./CategoryItemSkeleton"
import { useUserPreference } from "@/store/useUserPreference"
import DatePicker from "./DatePicker"
import { CameraIcon, Loader2Icon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

interface TransactionFormProps {
  transaction?: Transaction<string>
}

function TransactionForm({ transaction }: TransactionFormProps) {
  const form = useForm({
    resolver: zodResolver(transactionValidation.add),
    defaultValues: {
      type: transaction?.type || "expense",
      amount: transaction?.amount || "",
      category: transaction?.category || "",
      date: transaction?.date ? new Date(transaction?.date) : new Date(),
      time: transaction?.date
        ? format(new Date(transaction.date), "HH:mm")
        : format(new Date(), "HH:mm"),
      notes: transaction?.notes || "",
    },
  })
  const { mutate: create, isPending: creating } = useCreateTransaction()
  const { mutate: update, isPending: updating } = useUpdateTransaction()
  const { data: categoryData, isPending: isCategoriesLoading } =
    useGetAllCategories()
  const navigate = useNavigate()
  const currencyCode = useUserPreference((state) => state.currencyCode)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mutate: processOCR, isPending: processingOCR } =
    useProcessOCRTransaction()

  const currentType = form.watch("type")

  const filteredCategories = useMemo(() => {
    if (!categoryData) return []

    const allCategories = [
      ...(categoryData.defaultCategories || []),
      ...(categoryData.customCategories || []),
    ]

    return allCategories.filter((category) => {
      if (category.type === "both") {
        return true
      }
      return category.type === currentType
    })
  }, [categoryData, currentType])

  useMemo(() => {
    const currentCategoryId = form.getValues("category")
    const categoryExists = filteredCategories.some(
      (cat) => cat._id === currentCategoryId,
    )

    if (currentCategoryId && !categoryExists) {
      form.setValue("category", "", { shouldValidate: true })
      form.trigger("category")
    }
  }, [filteredCategories, form])

  const onSubmit = (data: FormDataTransaction) => {
    const [hours, minutes] = data.time.split(":").map(Number)
    const dateWithTime = new Date(data.date)
    dateWithTime.setHours(hours, minutes, 0, 0)

    const transactionData = {
      type: data.type,
      amount: data.amount,
      category: data.category,
      date: dateWithTime,
      notes: data.notes,
    }
    if (transaction) {
      update(
        { id: transaction._id, data: transactionData },
        {
          onSuccess: () => navigate("/transactions"),
          onError: (error) => {
            const axiosError = error as AxiosError<
              ErrorResponse<TransactionFieldErrors>
            >

            if (
              axiosError.response &&
              axiosError.response.status === 400 &&
              axiosError.response.data?.errors
            ) {
              const fieldErrors = axiosError.response.data.errors

              Object.entries(fieldErrors).forEach(([fieldName, messages]) => {
                if (messages && messages.length > 0) {
                  form.setError(fieldName as keyof FormDataTransaction, {
                    type: "server",
                    message: messages[0],
                  })
                }
              })
            }
          },
        },
      )
    } else {
      create(transactionData, {
        onSuccess: () => navigate("/transactions"),
        onError: (error) => {
          const axiosError = error as AxiosError<
            ErrorResponse<TransactionFieldErrors>
          >

          if (
            axiosError.response &&
            axiosError.response.status === 400 &&
            axiosError.response.data?.errors
          ) {
            const fieldErrors = axiosError.response.data.errors

            Object.entries(fieldErrors).forEach(([fieldName, messages]) => {
              if (messages && messages.length > 0) {
                form.setError(fieldName as keyof FormDataTransaction, {
                  type: "server",
                  message: messages[0],
                })
              }
            })
          }
        },
      })
    }
  }

  const handleOcrClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size >= 2 * 1024 * 1024) {
        toast.error("File size exceeds 2MB limit")
        return
      }
      processOCR(file, {
        onSuccess: (response) => {
          const data = response.data
          if (data.amount) form.setValue("amount", data.amount)
          if (data.notes) form.setValue("notes", data.notes)
          if (data.type) form.setValue("type", data.type)
          if (data.date) {
            const parsedDate = new Date(data.date)
            if (!isNaN(parsedDate.getTime())) {
              form.setValue("date", parsedDate)
            }
          }
          if (data.categoryId) {
            form.setValue("category", data.categoryId)
          }

          e.target.value = ""
        },
        onError: () => {
          e.target.value = ""
        },
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {transaction ? "Edit Transaction" : "Add New Transaction"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-dashed border-2 h-16 text-lg"
            onClick={handleOcrClick}
            disabled={processingOCR}
          >
            {processingOCR ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <>
                <CameraIcon className="size-6" />
                <span>Scan Receipt with AI</span>
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Upload an image of your receipt to automatically fill the form
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="expense" id="expense" />
                        <Label htmlFor="expense">Expense</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="income" id="income" />
                        <Label htmlFor="income">Income</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({currencyCode})</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0"
                      type="number"
                      {...field}
                      value={
                        field.value === undefined || field.value === null
                          ? ""
                          : String(field.value)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Category{" "}
                    {isCategoriesLoading && (
                      <Loader2Icon className="animate-spin size-4" />
                    )}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isCategoriesLoading ? (
                        <CategoryItemSkeleton />
                      ) : (
                        filteredCategories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="time" {...field} className="pl-3" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a note to this transaction..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              disabled={creating || updating || isCategoriesLoading}
              className="w-full"
              type="submit"
            >
              {creating || updating ? (
                <Loader2Icon className="animate-spin" />
              ) : transaction ? (
                "Update Transaction"
              ) : (
                "Add Transaction"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default TransactionForm
